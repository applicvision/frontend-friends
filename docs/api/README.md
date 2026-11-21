## Modules

- [`@applicvision/frontend-friends`](#applicvisionfrontend-friends) – the most commonly used functionality
- [`@applicvision/frontend-friends/declarative-element`](#applicvisionfrontend-friendsdeclarative-element) – custom elements
- [`@applicvision/frontend-friends/island`](#applicvisionfrontend-friendsisland) – interactive islands
- [`@applicvision/frontend-friends/dynamic-fragment`](#applicvisionfrontend-friendsdynamic-fragment) – dynamic HTML
- [`@applicvision/frontend-friends/special-attributes`](#applicvisionfrontend-friendsspecial-attributes) – two-way bindings, element references
- [`@applicvision/frontend-friends/attribute-helpers`](#applicvisionfrontend-friendsattribute-helpers) – helpers for attribute values
- [`@applicvision/frontend-friends/deep-watch`](#applicvisionfrontend-friendsdeep-watch) – reactive objects
- [`@applicvision/frontend-friends/plugins`](#applicvisionfrontend-friendsplugins) – extend islands and elements
- [`@applicvision/frontend-friends/store`](#applicvisionfrontend-friendsstore) – shared data
- [`@applicvision/frontend-friends/parse-shape`](#applicvisionfrontend-friendsparse-shape) – validate data
- [`@applicvision/frontend-friends/router`](#applicvisionfrontend-friendsrouter) – server-side rendering and routing

## `@applicvision/frontend-friends`

The main module exports the most commonly used functionality from the other exported modules.

- [`DeclarativeElement`](#declarativeelement)
- [`html`](#htmlstrings-string-values--dynamicfragment)
- [`css`](#cssstrings-string-values)
- [`island`](#island)
- [`twoway`](#twowayt-extends-objectstate-t-property-keyof-t-twowaybinding)
- [`ref`](#reftype-elementreference)
- [`definePlugin`](#defineplugincreator-plugincreator-plugincreator)

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

customElements.define('custom-element', MyCustomElement)
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

Set this property to a binding object to make the element's state two-way bound. If you want to use a property of a [reactive](#reactivet-extends-objectobject-t-effect-keypath-string--void-t) object as a shared state, the [`twoway`](#twowayt-extends-objectstate-t-property-keyof-t-twowaybinding) function can be used here. But any object conforming to [`TwoWayBinding`](#twowaybinding) can be used. 

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


##### `invalidate(): Promise`

Requests an asynchronous re-rendering of the component. A promise is returned, which resolves when the component has been updated.

##### `get isRendering: boolean`

`true` while the render function is running.

##### `protected componentDidUpdate()`

Override this function to run code after the component has been updated. It is not called after the first rendering.

##### `protected twoway(state, property)`

The [`twoway`](#twowayt-extends-objectstate-t-property-keyof-t-twowaybinding) function, available as a method for convenience. Effects added with `withEffect` are called with the component as `this`.

*Example:*
```javascript
render() {
    return html`<input ff-share=${this.twoway(this.state, 'text').withEffect(this.textChanged)}>`
}
```

##### `protected usePlugin<State>(pluginCreator: PluginCreator<State>): State`

Adds a [plugin](#applicvisionfrontend-friendsplugins) to the component. Call it when the component is constructed, typically in a field initializer. The returned object gives access to the state of the plugin.

*Example:*
```javascript
class ClockElement extends DeclarativeElement {
    clock = this.usePlugin(clockPlugin)

    render() {
        return html`<time>${this.clock.time.toLocaleTimeString()}</time>`
    }
}
```

Elements automatically subscribe to the [store](#applicvisionfrontend-friendsstore) resources and the [router](#applicvisionfrontend-friendsrouter) properties read during rendering, so there is no need to add plugins for that.

##### `reactive<T extends object>(object: T, effect?: (keypath: string[]) => void): T`

Call `reactive` to convert an initial state object to a deep reactive object. Any subsequent mutation to the object will trigger the effect function. The default effect function simply triggers an update using [`invalidate()`](#invalidate-promise). To monitor objects for changes, a JavaScript Proxy is used. The deep watch functionality is also available on its own, [`deepWatch`](#applicvisionfrontend-friendsdeep-watch).

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

Tag function for adding CSS to your component. The function returns an instance of `StyleDeclaration` which can be assigned to the component's [style](#static-style-styledeclarationstyledeclaration). The CSS will be added to the [`adoptedStyleSheets`](https://developer.mozilla.org/en-US/docs/Web/API/ShadowRoot/adoptedStyleSheets) property of the `ShadowRoot`. Thus, it will be isolated from 'outside' CSS. The tag function supports nesting of ``` css`` ```-expressions as in the following example.

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

This is the module for working with pieces of dynamic content or interactivity, so-called interactive islands. This module can also be used in a JavaScript server environment such as NodeJS, for server-side rendering.

Note that this is not the place to go for making a component based architecture. For that you would use [`DeclarativeElement`](#applicvisionfrontend-friendsdeclarative-element).

The module exports a factory function for creating islands and the underlying class.

* [`island`](#island)
* [`DynamicIsland`](#dynamicisland)


### `island()`

Factory function to create islands. It can be used in three ways.

#### Island without state

Pass just one argument, a render function. The island will not have any reactive state, and updates need to be triggered manually with [`.invalidate()`](#invalidate-promise-1). However, the island automatically updates when [store](#applicvisionfrontend-friendsstore) resources or [router](#applicvisionfrontend-friendsrouter) properties it reads change.

```typescript
island(render: () => DynamicFragment): DynamicIsland
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

#### Island with state

Pass the initial state as the first argument, and the render function as the second. If the state is an object, it is made reactive using [`deepWatch()`](#deepwatcht-extends-objecttarget-t-modificationcallback-keypath-string--void-t), so changes to it cause the island to update. The render function is called with the state.

```typescript
island<T>(initialState: T, render: (state: T) => DynamicFragment): DynamicIsland<T>
```

*Example:*
```javascript
const helloIsland = island(
    { name: 'unknown' },
    (state) => html`<h1>Hello ${state.name}</h1>`
)

helloIsland.mount(document.body)

// Changing state triggers update
helloIsland.state.name = 'World'
```

The state can also be a primitive value. Then assign a new value to [`.state`](#get-state--set-state) to update the island.

```javascript
const counter = island(0, (count) => html`<button onclick=${() => counter.state++}>${count}</button>`)
```

> [!Note]
> If the state object has a key named `refs` or `plugins`, it is interpreted as the object form described below.

#### Island with refs and plugins

To use [element references](#reftype-elementreference) or [plugins](#applicvisionfrontend-friendsplugins), pass an object with the keys `state`, `refs` and/or `plugins` as the first argument. The render function is then called with an object with the same keys. For plugins, the value is the state of each plugin.

```typescript
island(
    properties: { state?: State, refs?: Refs, plugins?: Plugins },
    render: (context: { state: State, refs: Refs, plugins: PluginsState }) => DynamicFragment
): DynamicIsland<State, Refs, Plugins>
```

*Example:*
```javascript
const searchIsland = island({
    state: { query: '' },
    refs: { input: ref(HTMLInputElement) },
    plugins: { clock: clockPlugin }
}, ({ state, refs, plugins }) => html`
    <input ff-ref=${refs.input} ff-share=${twoway(state, 'query')}>
    <button onclick=${() => refs.input.element?.select()}>Select</button>
    <time>${plugins.clock.time.toLocaleTimeString()}</time>
`)
```


### `DynamicIsland`

```javascript
class DynamicIsland extends EventTarget
```

Underlying class for islands. It is similar to `DeclarativeElement` in the sense that it manages its own rendering.

#### Constructor

The recommended way to create instances of `DynamicIsland` is to use the [island](#island) function.

```typescript
new DynamicIsland(properties: { state?, refs?, plugins? }, render: (context) => DynamicFragment)
```

#### Events

| Event | Description |
| --- | --- |
| `mount` | Dispatched when the island has been mounted. |
| `update` | Dispatched after every rendering of a mounted island. |
| `statechange` | Dispatched when the reactive state changes. The `detail` contains the `keypath` of the change. |

*Example:*
```javascript
anIsland.addEventListener('statechange', (event) => console.log('changed', event.detail.keypath))
```

#### instance properties

##### `get container: HTMLElement|null`

The element in which the island is mounted, or `null`.

##### `get hydratable: string`

Returns a string representation of the island for server-side rendering. It calls the render function, with the plugins set up, but does not set up any reactivity. Use [`.hydrate()`](#hydratecontainer-htmlelement) in the browser to make the HTML interactive.

*Example:*
```javascript
// On the server
const html = `<div id="app">${myIsland.hydratable}</div>`

// In the browser
myIsland.hydrate(document.getElementById('app'))
```

##### `get isMounted: boolean`

`true` if the island is mounted or hydrated.

#####  `pendingUpdate: Promise|null`

If an update is awaiting, `pendingUpdate` is a promise which resolves when the update is complete. Otherwise it is `null`.

##### `get refs`

The [element references](#reftype-elementreference) passed to the island.

##### `get state` / `set state`

This is the current reactive state of the island. Changes to the state will cause the island to update. Assigning a new state also causes an update.

*Example:*
```javascript
const anIsland = island(
    { value: 1 },
    (state) => html`${state.value}`
)

setInterval(() => anIsland.state.value++, 1000)
```


#### instance methods

##### `hydrate(container: HTMLElement)`

If [`.hydratable`](#get-hydratable-string) has been used on the server to send HTML to the client, `.hydrate()` can be used to prepare the island for interactivity. Pass the container which contains the hydratable HTML. The existing elements are kept, and event listeners are attached. See [`DynamicFragment.hydrate()`](#hydratecontainer-htmlelementshadowroot-eventhandlercontext-unknown) for more details.

> [!Note]
> The state when hydrating must give the same result as on the server. Otherwise the content will not match the state until it changes.

##### `invalidate(): Promise`

Requests an asynchronous re-rendering of the island. A promise is returned, which resolves when the island has been updated.

##### `mount(container: HTMLElement)`

Mounts the island in the given container, replacing its content. If the island is already mounted somewhere else, it is first unmounted from there.

##### `unmount(cacheFragment?: boolean)`

Unmounts the island, and optionally caches the current fragment in memory for later reuse. By default, the fragment cache is cleared on unmount. The plugins are cleaned up, and subscriptions to stores and the router are removed.

## `@applicvision/frontend-friends/dynamic-fragment`

This is the module for creating dynamic pieces of HTML. It is used in both [`DeclarativeElement`](#declarativeelement) and islands. It exports the following:

- [`html`](#htmlstrings-string-values--dynamicfragment)
- [`DynamicFragment`](#dynamicfragment)
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

Using expressions within `${}`, dynamic parts can be added to the HTML string.

Those dynamic parts can be attributes:

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
>In the case of input elements, changing the value or checked attribute in the dynamic fragment causes the property with the same name of the `HTMLInputElement` instance to be set rather than the attribute, since that is usually desirable.

The expressions can also be event handlers. The attributes for event handlers should start with 'on' followed by the event name.

#### *Event Handlers*

```javascript
html`<button onclick=${(event) => console.log('click', event)}>Click me!</button>`
```

This might seem to go against all [recommendations](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Scripting/Events#inline_event_handlers_%E2%80%94_dont_use_these), but under the hood the event handler is added with `addEventListener`, and no inline event handler attribute is added to the HTML. For [`DeclarativeElement`](#declarativeelement), the event handler is called with the component instance as `this`, so no need for manual binding.

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

Instead, in order to have HTML in the expressions, use a nested ``` html`` ```:

```javascript
html`<section>${ html`<h2>${'Hello'}</h2>` }</section>`
// Will create a header with text 'Hello'
```

If for some reason, more dynamic HTML is needed, there is more info in the [`innerHTML`](#innerhtml) section.

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
* [keyed Array items](#keykey-stringnumber-this)

### `html.key(key: string|number) => (strings: string[], ...values)` `=>` [`DynamicFragment`](#dynamicfragment)

Associates a given key with the `DynamicFragment`. More info [here](#keykey-stringnumber-this).

*Example:*

```javascript
html.key(item.id)`<li>${item.title}</li>`

// equivalent to
html`<li>${item.title}</li>`.key(item.id)
```

### `TwoWayBinding`

A simple type which two-way bindings should implement. For more information about two-way bindings, check out the section on the twoway-helper, [twoway](#twowayt-extends-objectstate-t-property-keyof-t-twowaybinding).

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

The way setting properties is achieved in `DynamicFragment`, is by creating an instance of `PropertySetter` and pass that as a 'child' to the element.

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

Do not instantiate `DynamicFragment` using the constructor. Instead use the [tag function](#htmlstrings-string-values--dynamicfragment). The class is primarily exported for type checking. But one thing to note is that creating `DynamicFragment` is a very cheap operation. It neither touches the document, nor constructs an HTML string when created. Only when mounted, or when `.toString()` is called, does it form the HTML string, adds it to the document and attaches event listeners.

> [!Note]
> Depending on what you put in the expessions, `${}`, the ``` html`` ``` statement can be heavy, but that is not really part of the `DynamicFragment` creation.

#### instance properties

##### `values: (DynamicFragment|DynamicFragment[]|PropertySetter|string|number|boolean|Function|InnerHTML|TwowayBinding|null|undefined)[]`

The `values` array represents the current dynamic pieces in the tagged template, that is the content inside of `${}`-blocks in the string. Setting the values array causes a synchronous DOM update. That is what [DeclarativeElement](#declarativeelement) and islands do when re-rendering.

#### Instance methods

##### `hydrate(container: HTMLElement|ShadowRoot, eventHandlerContext?: unknown)`

Attaches event listeners and collects references to DOM nodes which might later be updated, that is at the locations of the `${}` expressions. Similar to [`.mount()`](#mountcontainer-htmlelementshadowroot-eventhandlercontext-unknown), an event handler context can be passed to the hydrate method. In fact, the `.mount()` method is simply a combination of `.toString()` and `.hydrate()`:

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

* [`deepWatch`](#deepwatcht-extends-objecttarget-t-modificationcallback-keypath-string--void-t)
* [`effect`](#effectt-extends-objecttarget-t-effect-target-t--void-t)

### `deepWatch<T extends object>(target: T, modificationCallback: (keypath: string[]) => void): T`

Pass in a target object to get a deep copy back which will be watched for changes. For every change to the returned object, the `modificationCallback` will be called synchronously with the keypath of the changed property as argument.

The callback is also called with the new and the old value as second and third arguments. Note that they might be the same.

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

## `@applicvision/frontend-friends/special-attributes`

Special attributes are attributes starting with `ff-`, which get special treatment in a [`DynamicFragment`](#dynamicfragment). Two special attributes are built in:

* `ff-share` – two-way bindings, see [`twoway`](#twowayt-extends-objectstate-t-property-keyof-t-twowaybinding)
* `ff-ref` – element references, see [`ref`](#reftype-elementreference)

The module exports:

* [`twoway`](#twowayt-extends-objectstate-t-property-keyof-t-twowaybinding)
* [`ref`](#reftype-elementreference)
* [`registerSpecialAttribute`](#registerspecialattributename-string-specification-specialattribute)
* [`unregisterSpecialAttribute`](#unregisterspecialattributename-string-boolean)

### `twoway<T extends object>(state: T, property: keyof T):` [`TwowayBinding`](#twowaybinding)

`DynamicFragment` offers a convenient way to work with data which can change, for example by a user entering text in a text field. A special attribute named `ff-share` can be used to pass a two-way binding to native input elements (`<input type="...">`), text areas (`<textarea></textarea>`), selects (`<select><option></select>`) and custom elements which can change data somehow.

The `twoway` function can help with creating a [`TwowayBinding`](#twowaybinding), which is simply an object with a `get` and `set` function respectively.

A common scenario would be having a state with a string that should be edited by the user. And then perform some logic on that string for every change by the user. Here is an island demonstrating that.

*Example:*
```javascript
island(
    { text: '' },
    (state) => html`
        <input ff-share=${twoway(state, 'text')}>
        <div>length: ${state.text.length}</div>
    `
)
```

`ff-share` can also be used together with `DeclarativeElement`. The `DynamicFragment` automatically assigns the twoway binding to [`sharedStateBinding`](#set-sharedstatebinding-twowaybinding).

*Example:*
```javascript
class ToggleButton extends DeclarativeElement {
    render() {
        return html`
            <button onclick=${() => this.sharedState = !this.sharedState}>
                ${this.sharedState ? 'on' : 'off'}
            </button>
            `
    }
}

// Given a state of {active: boolean}, shared state would be passed like this to the ToggleButton
html`<toggle-button ff-share=${twoway(state, 'active')}></toggle-button>`
```

It is also possible to attach a side effect to the twoway binding, by using `withEffect`. For instance if you have some state which depends on another state, or just want a place to log something.

*Example:*
```javascript
html`<input ff-share=${twoway(state, 'text').withEffect(newText => console.log('The new text', newText))}>`
```

If the value in the state has a different type than the value of the field, two transform functions can be passed. The first converts the value from the field to the state, and the second from the state to the field.

*Example:*
```javascript
// state.amount is a number, but the input field works with strings
html`<input type="number" ff-share=${twoway(state, 'amount', Number, String)}>`
```

### `ref(type?): ElementReference`

Creates a reference to an element in a template. Pass it to the `ff-ref` special attribute, and the element is available as `.element` after rendering. Optionally pass the expected element class. Then the type of `.element` is that class, and an error is thrown if the element has a different type.

`ElementReference` has the following properties:

* `element` – the referenced element, or `null`
* `elementOrThrow` – the referenced element. Throws if it is missing.

*Example:*
```javascript
const form = island({
    refs: { input: ref(HTMLInputElement) }
}, ({ refs }) => html`
    <input ff-ref=${refs.input}>
    <button onclick=${() => refs.input.elementOrThrow.focus()}>Focus</button>
`)
```

### `registerSpecialAttribute(name: string, specification: SpecialAttribute)`

Registers a custom special attribute. The name must start with `ff-`. The specification is an object with the following properties:

* `update(element, value, previousValue)` – required. Called when the attribute is rendered, and every time the value changes.
* `connect(element, getCurrentValue)` – optional. Called once, when the element is connected to the fragment.
* `isElementValid(element)` – optional. Return `false` to throw an error if the attribute is used on an unsupported element.
* `isValueValid(value)` – optional. Return `false` to throw an error if the value is not supported.

*Example:*
```javascript
registerSpecialAttribute('ff-focus', {
    isValueValid: (value) => typeof value == 'boolean',
    update(element, shouldFocus) {
        if (shouldFocus) element.focus()
    }
})

html`<input ff-focus=${state.editing}>`
```

### `unregisterSpecialAttribute(name: string): boolean`

Removes a special attribute registered with [`registerSpecialAttribute`](#registerspecialattributename-string-specification-specialattribute). The built-in attributes can not be removed.

## `@applicvision/frontend-friends/attribute-helpers`

Utility module to work with attributes. It exports two functions:

* [`tokens`](#tokensdefinitionparts-object--string--object--string-string)
* [`style`](#styledeclaration-partialcssstyledeclaration-string)

### `tokens(...definitionParts: (object | string | (object | string)[])[]): string`

Pass an arbitrary number of arguments consisting of strings, objects or arrays of strings or objects. The arguments passed will be flattened to one space separated string of unique tokens which can be passed to attributes expecting space separated values, such as `class`.

Object arguments will have their keys passed to the resulting string if their values are truthy.

*Example:*
```javascript
const isActive = false
const loading = true
const classes = tokens('base', { active: isActive, loading })
// classes => 'base loading'
html`<button class=${classes}>click</button>`

const classes2 = tokens('alfa beta', [{ 'gamma': true }], 'beta ', { 'beta alfa': true })
// classes2 => 'alfa beta gamma'
```

### `style(declaration: Partial<CSSStyleDeclaration>): string`

Creates a string for the `style` attribute from an object. Property names are written in camel case, as in `CSSStyleDeclaration`. Properties with values which are falsy (except `0`) are left out.

*Example:*
```javascript
const styleString = style({ backgroundColor: 'yellow', marginTop: 0, display: isHidden && 'none' })
// styleString => 'background-color: yellow; margin-top: 0'
html`<div style=${styleString}>Hello</div>`
```

## `@applicvision/frontend-friends/plugins`

Plugins add reusable behaviour to [islands](#island) and [`DeclarativeElement`](#declarativeelement). A plugin can have state which is available when rendering, wrap the rendering, and trigger updates.

The [store](#applicvisionfrontend-friendsstore) and the [router](#applicvisionfrontend-friendsrouter) are connected to islands and elements with built-in plugins. That is how islands and elements update when they change.

### `definePlugin(creator: PluginCreator): PluginCreator`

Defines a plugin. It simply returns the creator function, but gives correct type hints. The creator function is called when the island is mounted (or hydrated), or when the element is connected. It is called with two arguments:

* `invalidate` – a function which requests an update of the island or element.
* `element` – the element of the component, or the container of the island. On the server, when rendering [`hydratable`](#get-hydratable-string), it is `null`.

The creator should return an object with any of these properties:

* `state` – an object which is passed to the render function.
* `middleware(render)` – called on every rendering. It must call `render` exactly once. This can be used to do something before or after the rendering.
* `cleanup()` – called when the island is unmounted, or the element is disconnected.

*Example:*
```javascript
import { definePlugin, island, html } from '@applicvision/frontend-friends'

const clockPlugin = definePlugin((invalidate) => {
    const state = { time: new Date() }
    const interval = setInterval(() => {
        state.time = new Date()
        invalidate()
    }, 1000)
    return {
        state,
        cleanup: () => clearInterval(interval)
    }
})

// In an island
const clock = island(
    { plugins: { clock: clockPlugin } },
    ({ plugins }) => html`<time>${plugins.clock.time.toLocaleTimeString()}</time>`
)

// In an element
class ClockElement extends DeclarativeElement {
    clock = this.usePlugin(clockPlugin)

    render() {
        return html`<time>${this.clock.time.toLocaleTimeString()}</time>`
    }
}
```

## `@applicvision/frontend-friends/store`

The store holds shared data, organised in resources identified by an `id`. Islands and elements which read from the store during rendering subscribe to what they read, and update automatically when it changes.

### `getStore(template: object)`

Creates a store with one `ResourceStore` for every key of the template. The values of the template are only used for type hints.

*Example:*
```javascript
import { getStore } from '@applicvision/frontend-friends/store'

class Book {
    /** @type {string} */ id
    /** @type {string} */ title
}

export const store = getStore({ books: Book })

store.books.insert({ id: '1', title: 'Frankenstein' })

const bookIsland = island(() => html`<h1>${store.books.get('1').title}</h1>`)

// Updates the island
store.books.update('1', { title: 'Frankenstein; or, The Modern Prometheus' })
```

Reading a resource with `get(id)` subscribes to changes of that resource. Reading all resources with `getAll()` subscribes to all changes in the resource store.

### `ResourceStore`

#### instance methods

##### `get(id: string): T`

Returns the resource with the given id.

##### `getAll(): T[]`

Returns all resources.

##### `insert(...entries: T[] | T[][]): T[]`

Inserts one or more resources. Every resource must have an `id` property. Arrays of resources are also accepted. Throws if a resource with the same id already exists.

##### `insertWithId(id: string, entry: T): T`

Inserts a resource with an explicit id.

##### `upsert(...entries: T[] | T[][]): T[]`

Like `insert`, but existing resources are updated instead.

##### `update(id: string, updates: Partial<T>): T`

Updates the resource with the given id by assigning the updated properties to it.

##### `delete(id: string)`

Deletes the resource with the given id.

##### `clear()`

Removes all resources, and all subscriptions to them.

##### `subscribe(listener: StoreSubscriber, id?: string)` / `unsubscribe(listener: StoreSubscriber, id?: string)` / `unsubscribeAll(listener: StoreSubscriber)`

Manual subscriptions. A subscriber is an object with a `storeChanged(resourceStore, id?)` method. Pass an id to subscribe to a single resource. Usually, the automatic subscriptions are enough.

### Other functions

* `unsubscribe(store, listener)` – removes a subscriber from all resource stores in a store.
* `seedStore(store, data)` – inserts data, an object with an array of resources for every key, into the store.
* `serialize(store)` – the opposite of `seedStore`. Returns an object with an array of all resources for every key.
* `clearStore(store)` – clears all resource stores in a store.

## `@applicvision/frontend-friends/parse-shape`

Validates unknown data, for instance JSON from a server, against a shape. The result is typed according to the shape.

A shape is described with:

* `String`, `Number` and `Boolean` – a value of that type.
* `Date` and `URL` – a value which can be converted to a `Date` or a `URL`, for instance a string.
* An array with one shape, `[shape]` – an array where every item has that shape.
* An object, `{ key: shape }` – an object where every key has its shape. Other keys are left out.
* [`optional(shape)`](#optionalshape) – the value can be `undefined`.
* Another class – the data is passed to the constructor, and then assigned to the instance.

If the data does not match, a `ParseShapeError` is thrown. Its `keyPath` property tells where the mismatch was found.

### `parse(shape, data)`

Parses the data using the shape.

*Example:*
```javascript
import { parse, optional } from '@applicvision/frontend-friends/parse-shape'

const response = await fetch('/api/books')
const books = parse([{ id: String, title: String, published: Date, rating: optional(Number) }], await response.json())
// books[0].published is a Date
```

### `shape(definition)`

Creates a reusable shape, with a `parse(data)` method.

```javascript
const Book = shape({ id: String, title: String })
const book = Book.parse(data)
```

### `optional(shape)`

Marks a value as optional.

## `@applicvision/frontend-friends/router`

The router renders pages on the server and takes over navigation in the browser. Pages are put together from HTML files, *views* and *layouts*, with [islands](#island) for the dynamic parts. The islands are rendered on the server, using the data loaded by the route, and hydrated in the browser.

When a link is followed, the browser only loads the part of the page which changes, and updates the islands. Going back and forward in the history restores pages without loading them again.

The module exports a `Router` class. In Node.js, the [`node` export condition](https://nodejs.org/api/packages.html#conditional-exports) resolves the module to the server router. Elsewhere it resolves to the browser router. Both have the same configuration, so the router is defined in one module which is used both on the server and in the browser.

> [!Note]
> The server router requires Node.js 24 or later, since it uses [`URLPattern`](https://developer.mozilla.org/en-US/docs/Web/API/URLPattern). The browser router requires the [Navigation API](https://developer.mozilla.org/en-US/docs/Web/API/Navigation_API).

A complete example is available in [`examples/library`](https://github.com/applicvision/frontend-friends/tree/main/examples/library).

### `Router.create(config: RouteConfig): Router`

Creates a router. The configuration describes the root route, and its children:

```typescript
type RouteConfig = {
    // HTML file wrapping the views of this route and its child routes
    layout?: string
    // HTML file for this route
    view?: string
    // Loads data for this route
    load?: (get, params: Record<string, string>, query: URLSearchParams) => Promise<unknown>
    // A resource store to put the loaded data in
    store?: ResourceStore
    // Child routes, by path
    children?: { [path: string]: RouteConfig }
}
```

The paths of the children are added to the path of the parent route. A path segment starting with `:` is a parameter. Constant paths are matched before parameters. The full path of a route, for instance `'books/:id'`, identifies the route in methods such as [`linkTo`](#linktopath-string-params-string-string). The root route has the path `''`. Every route must have at least a `layout`, a `view` or a `load` function.

The file names of layouts and views are relative to the `directory` passed to [`mount`](#mountoptions-directory-string-base-string-handler) on the server.

*Example:*
```javascript
// app/router.js
import { Router } from '@applicvision/frontend-friends/router'
import { store } from './store.js'

const Book = { id: String, title: String, author: String }

export const router = Router.create({
    layout: 'layout.html',
    view: 'home.html',
    children: {
        about: { view: 'about.html' },
        books: {
            layout: 'books/layout.html',
            view: 'books/list.html',
            load: (get, params, query) => get([Book], `/api/books?${query}`),
            children: {
                ':id': {
                    view: 'books/book.html',
                    store: store.books,
                    load: (get, { id }) => get(Book, `/api/books/${id}`)
                }
            }
        }
    }
})
```

The module defining the router must export it with the name `router`.

### Views and layouts

A page is put together from the layouts of the route and all its parents, outermost first, with the view of the route inside. A layout marks where the content goes with an outlet:

```html
<ff-outlet></ff-outlet>
```

The outermost layout should be a complete HTML document. It should also contain the `ff-router` element, which is replaced by the script starting the router in the browser. The `src` attribute is the path to the module exporting the router, relative to the layout. A path starting with `/` is relative to the router directory instead:

```html
<ff-router src="router.js"></ff-router>
```

Since the islands and the router are loaded as modules in the browser, the layout also needs an [import map](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script/type/importmap) for `@applicvision/frontend-friends`. See [Getting started](https://github.com/applicvision/frontend-friends#cdn) in the readme. The map must resolve `@applicvision/frontend-friends/router` to the browser router, `src/router/browser-router.js`.

Islands are added to views and layouts with the `ff-island` element. The `src` attribute is the path to a module, relative to the HTML file, or to the router directory if it starts with `/`. By default the default export of the module is used. Add `?name` to the path to use a named export instead.

```html
<ff-island src="islands/book-list.js"></ff-island>
<ff-island src="islands/books.js?bookCount"></ff-island>
```

The island module is imported on the server to render the island, and in the browser to hydrate it.

> [!Note]
> The router finds these elements by their exact markup. Write `<ff-outlet></ff-outlet>` and `<ff-router src="..."></ff-router>` without any content or other attributes, and do not add other attributes to `ff-island`.

> [!Caution]
> All files in the directory of the router are publicly available, since the browser imports the islands and the router from there. Do not put any secrets in it.

### Loading data

The `load` function of a route is called with three arguments:

* `get(shape, input, init?)` – fetches JSON and parses it with [`parse`](#parseshape-data). The arguments `input` and `init` are the same as for [`fetch`](https://developer.mozilla.org/en-US/docs/Web/API/Window/fetch).
* `params` – the parameters of the path.
* `query` – the query parameters, as `URLSearchParams`.

On the server, a relative URL passed to `get`, such as `'/api/books'`, is handled directly by the server, without going over the network. The headers of the page request, such as cookies, are passed along. Other URLs are fetched as usual.

The responses fetched on the server are added to the page, so that the browser does not need to fetch them again when the router starts.

The loaded data is available through [`dataFor`](#datafortpath-string). If the route has a `store`, the data is also upserted into it. The data must then be a resource with an `id`, or an array of resources.

> [!Note]
> Only the `load` function of the matched route is called, not the ones of its parents. If an island in a layout needs data, load it in the child routes, or use a store.

### Rendering

When rendering on the server, and when updating in the browser, the islands can read the current state of the router: [`dataFor`](#datafortpath-string), [`paramsFor`](#paramsforpath-string), [`params`](#get-params-recordstring-string), [`query`](#get-query-urlsearchparams) and [`path`](#get-path-string--null). Islands and elements which read these properties during rendering are updated when they change.

*Example:*
```javascript
// app/islands/book.js
import { island, html } from '@applicvision/frontend-friends'
import { router } from '../router.js'
import { store } from '../store.js'

export default island(() => {
    const { id } = router.paramsFor('books/:id')
    const book = store.books.get(id)
    return html`
        <h2>${book.title}</h2>
        <a href=${router.linkTo('books')}>All books</a>`
})
```

> [!Note]
> An island module is a single island instance. It can only be shown in one place at a time.

### Navigation in the browser

The browser router handles navigations to routes it knows, such as followed links, submitted forms using `GET` and history traversal. Navigations to other URLs are left to the browser.

* **Another route** – the view is rendered on the server, from the nearest layout which is already on the page, and put in its outlet. The data is loaded on the server as well. The new islands are mounted.
* **The same route** with other parameters or query – only the `load` function is called, in the browser, and the islands using the router are updated.
* **Back and forward** – the previous content and data are restored from memory. Nothing is loaded.

### Server

#### `mount(options?: {directory?: string, base?: string}): handler`

Mounts the router, and returns a request handler for a Node.js HTTP server: `(request, response, server) => Promise`.

* `directory` – the directory containing the views, layouts, islands and the router module. A relative path is resolved against the working directory of the process, so passing an absolute path, such as `path.join(import.meta.dirname, 'app')`, is recommended. Default `'.'`. The files are served to the browser with paths relative to this directory.
* `base` – an optional base path for all routes, for instance `'/app'`.

The handler handles requests for the routes, and for the views and files used by the browser router (under `<base>/_ff-router/`). It responds with `404` for unknown paths under the base path. Requests outside of the base path are not handled, so other handlers can take care of them.

The third argument, the server, is used for the internal requests made by `get`. If it is not passed, the server of the request socket is used.

*Example:*
```javascript
import { createServer } from 'node:http'
import path from 'node:path'
import { router } from './app/router.js'

const handleRoute = router.mount({ directory: path.join(import.meta.dirname, 'app'), base: '/app' })

const server = createServer(async (request, response) => {
    if (request.url.startsWith('/api/')) {
        return handleApi(request, response)
    }
    await handleRoute(request, response, server)

    if (!response.headersSent) {
        response.writeHead(404).end()
    }
})

server.listen(3000)
```

### Browser

#### `mount(options?: {base?: string}): Promise`

Starts the router in the browser. This is done automatically by the script which replaces `ff-router`, so it usually does not need to be called.

### Common properties and methods

#### `linkTo(path: string, params?: {[string]: string})`

Returns the URL path for the route with the given path, including the base path. Parameters are filled in from `params`. The router must be mounted.

```javascript
router.linkTo('books/:id', { id: '2' }) // => '/app/books/2'
```

#### `dataFor<T>(path: string)`

Returns the data loaded for the route with the given path, which must be the current route. With TypeScript, the type is the return type of the `load` function.

#### `paramsFor(path: string)`

Returns the parameters of the route with the given path, which must be the current route.

#### `get params: Record<string, string>`

The parameters of the current route.

#### `get query: URLSearchParams`

The query parameters of the current URL.

#### `get path: string | null`

The path of the current URL, including the base path.

#### `get route: Route | null`

The current route.

#### `get basePath: string`

The base path passed to `mount`.

#### `get isMounted: boolean`

`true` if the router is mounted.

