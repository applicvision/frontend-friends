# Frontend Friends &nbsp;&nbsp;&nbsp; [![Tests](https://github.com/applicvision/frontend-friends/actions/workflows/test.yml/badge.svg)](https://github.com/applicvision/frontend-friends/actions/workflows/test.yml) [![NPM Version](https://img.shields.io/npm/v/%40applicvision%2Ffrontend-friends)](https://www.npmjs.com/package/@applicvision/frontend-friends) [![Unpacked size](https://img.shields.io/npm/unpacked-size/%40applicvision%2Ffrontend-friends)](https://www.npmjs.com/package/@applicvision/frontend-friends)



*Say hi to your new best friends for frontend development!*

Frontend friends offer a lightweight alternative to massive SPA-libraries. The humble wish is to provide you with a great developer experience as you navigate between declarative views, easy-to-follow state management, two-way bindings, effective list rendering, component authoring and interactive islands. All this with type hints, but without any build step or extra dependencies.



## Getting started

To get the best developer experience, install Frontend Friends as an npm package.

```console
$ npm install @applicvision/frontend-friends
```

Then import it in your JavaScript.

```javascript
import { island, html } from '@applicvision/frontend-friends'

const app = island(
  () => html`<section>
    ${['You', 'did', 'it!'].map(
      text => html`<p>${text}</p>`
    )}
  </section>`
)

app.mount(document.body)
```

Then to check it out in your browser you have two options; CDN or build tool.

### CDN
The easiest way to get started is to let your web page get the code from a CDN which can deliver ES modules, such as JSDeliver, and their [modules CDN](https://www.jsdelivr.com/esm), or [esm.sh](https://esm.sh).

First, add an importmap to your html-file. This tells the browser to fetch all imports of `@applicvision/frontend-friends` from esm.sh.

```html
<script type="importmap">
{
  "imports": {
    "@applicvision/frontend-friends": "https://esm.sh/@applicvision/frontend-friends",
    "@applicvision/frontend-friends/": "https://esm.sh/@applicvision/frontend-friends/"
  }
}
</script>
```

Then, add a script tag pointing to your application:

```html
<script type="module" src="main.js"></script>
```

And that's it! Now serve your files any way you like, and start building your web application, using modern technologies without any intermediate build tool.

*But why `npm install` if the code is fetched from CDN?*

Good question! It is not needed for the application to run in the browser, but it is highly recommended to get the correct developer experience. [Here](https://www.typescriptlang.org/docs/handbook/modules/guides/choosing-compiler-options.html#im-writing-es-modules-for-the-browser-with-no-bundler-or-module-compiler) is some more information.

### Build tool

Since Frontend Friends is shipped as an npm package, it is naturally also possible to use in a build tool setup.
For instance, using vite:

```console
$ npm install -D vite
```

And then just start the dev server:

```console
$ npx vite
```

Using this strategy, no `<script type="importmap">` should be used.

For more information on using Vite, please consult their great documentation at https://vite.dev/

## Creating your first component

Frontend Friends leverages the built-in way to work with components; [Custom elements](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_custom_elements). So, as soon as the components are defined in the custom elements registry, they can be used anywhere on the page. Either straight in HTML, by dynamic creation `document.createElement`, or even in another view system such as Vue or React.

Let's say we want a greeting component. Here is a simple example:


```javascript
import { DeclarativeElement, html } from '@applicvision/frontend-friends'

// Make a class which extends DeclarativeElement
class GreetingLabel extends DeclarativeElement {

  // This will make the element react to changes to the 'name' attribute
  static observedAttributes = ['name']

  // The render function is called whenever the view needs an update
  // It should return a tagged template string, using the imported html function from frontend-friends
  render() {
    
    // This simply returns markup for a header with text Hello plus the name passed as attribute
    return html`<h2>Hello ${this.getAttribute('name')}!</h2>`
  }

  // Lastly, add a static initialization block to define the class in the custom elements registry.
  static { customElements.define('greeting-label', this) }
}
```

The name of the element has to include a hyphen, and follow some other [rules](https://developer.mozilla.org/en-US/docs/Web/API/CustomElementRegistry/define#valid_custom_element_names).

The `html` tag function in front of the backtick string literal might look a bit unfamiliar. But it has many advantages. Under the hood it is used both to determine which parts of the template are dynamic and which parts are not, and also to automatically cache pieces of rendered markup for potential reuse.

The tagged template strategy is also used in [Lit](https://lit.dev/docs/templates/overview/).

And it actually brings one additional advantage: we can get context awareness in the string. In the example code blocks here we get syntax highlighting for HTML even though we are in a JavaScript context. And there are useful extensions for VS Code to improve the developer experience. Feel free to explore available [extensions](https://marketplace.visualstudio.com/search?term=html%20tagged%20template&target=VSCode&category=All%20categories&sortBy=Relevance).

But now, back to our code. Our component is ready! We can now use the element directly in our HTML:

```html
<greeting-label name="World"></greeting-label>
<!-- note that custom elements must have a closing tag, even if they are 'empty' and not designed to render any content -->
```

The element can also be created dynamically:

```javascript
const greetingLabel = document.createElement('greeting-label')
greetingLabel.setAttribute('name', 'World')
document.body.appendChild(greetingLabel)
// Updating the attribute will re-render the element
greetingLabel.setAttribute('name', 'New world')
```

## Creating an island

Now let's use our `greeting-label` in a context together with an input field where the user could enter the name to be passed to the `greeting-label`. To do that, we can define a little 'micro-app'. These small pieces of logic are sometimes referred to as [islands](https://jasonformat.com/islands-architecture/).

```javascript
import { island, html } from '@applicvision/frontend-friends'

const app = island(
  // The first argument to island is the initial state.
  // It is made reactive, so changes to it will cause the island to update.
  { name: '' },
  // The second argument is the render function.
  // It is called with the current state of the island every time a visual update is needed.
  (state) => html`
    <input
      placeholder="Enter your name"
      value=${state.name}
      oninput=${updateName}
    >
    <greeting-label name=${state.name || 'stranger'}></greeting-label>
  `
)

function updateName(event) {
  app.state.name = event.target.value
}

// Here we assume an element with id app somewhere in the document.
app.mount(document.getElementById('app'))
```

This is quite a common pattern, so there is an easier way; we can use a two-way binding. That means we let the state be changed also directly by the input field. To enable this, a special attribute is used, `ff-share`. This indicates a two-way binding. It corresponds to `v-model` in [Vue](https://vuejs.org/api/built-in-directives.html#v-model).

So we rewrite the previous code slightly.

```javascript
// twoway is a little helper that simply creates an object with a set and a get function, which is the shape required for the two-way binding.
import { island, html, twoway } from '@applicvision/frontend-friends'

const app = island(
  { name: '' },
  (state) => html`
    <input
      placeholder="Enter your name"
      ff-share=${twoway(state, 'name')}
    >
    <greeting-label name=${state.name || 'stranger'}></greeting-label>
  `
)

app.mount(document.getElementById('app'))
```

Islands can also have references to elements, `refs`, and use plugins, `plugins`. Then pass an object with `refs` and/or `plugins`, and optionally `state`, and the render function is called with the same keys:

```javascript
import { island, html, ref, twoway } from '@applicvision/frontend-friends'

const searchBox = island({
  state: { query: '' },
  refs: { input: ref(HTMLInputElement) }
}, ({ state, refs }) => html`
  <input ff-ref=${refs.input} ff-share=${twoway(state, 'query')}>
  <button onclick=${() => refs.input.element?.focus()}>Focus</button>
`)
```

More about refs and plugins in the [API documentation](https://github.com/applicvision/frontend-friends/blob/main/docs/api/README.md#island).

## Server-side rendering and routing

Islands can be rendered to HTML on the server, and then *hydrated* in the browser. Frontend Friends includes a router that does this for you, for Node.js. Views and layouts are plain HTML files. A layout marks where the views of the child routes go with `<ff-outlet></ff-outlet>`, and where the router script should be added with `<ff-router>`:

```html
<!-- app/layout.html -->
<!DOCTYPE html>
<html>
<head>
  <script type="importmap">
    {
      "imports": {
        "@applicvision/frontend-friends": "https://esm.sh/@applicvision/frontend-friends",
        "@applicvision/frontend-friends/": "https://esm.sh/@applicvision/frontend-friends/"
      }
    }
  </script>
</head>
<body>
  <ff-outlet></ff-outlet>
  <ff-router src="router.js"></ff-router>
</body>
</html>
```

Islands are placed in views and layouts with the `ff-island` element:

```html
<!-- app/books.html -->
<h2>Books</h2>
<ff-island src="islands/book-list.js"></ff-island>
```

The routes are declared in a module which is used both on the server and in the browser:

```javascript
// app/router.js
import { Router } from '@applicvision/frontend-friends/router'

export const router = Router.create({
  layout: 'layout.html',
  view: 'home.html',
  children: {
    books: {
      view: 'books.html',
      load: (get) => get([{ id: String, title: String }], '/api/books'),
      children: {
        ':id': {
          view: 'book.html',
          load: (get, { id }) => get({ id: String, title: String }, `/api/books/${id}`)
        }
      }
    }
  }
})
```

And the islands can use the router to get data, parameters and links:

```javascript
// app/islands/book-list.js
import { island, html } from '@applicvision/frontend-friends'
import { router } from '../router.js'

export default island(() => html`
  <ul>${router.dataFor('books').map(book => html`
    <li><a href=${router.linkTo('books/:id', { id: book.id })}>${book.title}</a></li>`)}
  </ul>`
)
```

Finally, mount the router in a Node.js server:

```javascript
// server.js
import { createServer } from 'node:http'
import path from 'node:path'
import { router } from './app/router.js'

const handleRoute = router.mount({ directory: path.join(import.meta.dirname, 'app') })

const server = createServer((request, response) => handleRoute(request, response, server))
server.listen(3000)
```

The page is rendered on the server, together with the data loaded by the route. In the browser, the router takes over: islands are hydrated, and following links only loads and replaces the part of the page that changes. The islands in the new part are then rendered in the browser.

The router requires Node.js 24 or later on the server, and a browser supporting the [Navigation API](https://developer.mozilla.org/en-US/docs/Web/API/Navigation_API). Read more in the [API documentation](https://github.com/applicvision/frontend-friends/blob/main/docs/api/README.md#applicvisionfrontend-friendsrouter), and check out the [example app](#examples).

## Examples
A more extended example is located in the docs folder of the repository. The JavaScript can be found [here](https://github.com/applicvision/frontend-friends/blob/main/docs/js/todo-app.js). And, to check out the result of the example, please visit https://applicvision.github.io/frontend-friends/examples/todo.

An example of a server-rendered application using the router is located in [`examples/library`](https://github.com/applicvision/frontend-friends/tree/main/examples/library). It uses nested layouts, islands, route data, query parameters and a store. To run it, clone the repository and run:

```console
$ npm install
$ npm run serve-example
```

Then visit http://localhost:3002.


## Typescript

Yes, you can use TypeScript. Frontend friends includes JSDoc annotation for most of the API. For instance, DeclarativeElement can be a generic class if using shared state:

```typescript
class MyStatefulElement extends DeclarativeElement<boolean> {
  render() {
    // this.sharedState state is boolean here
    return html`active: ${this.sharedState}`
  }
}
```

## API Documentation

API documentation is available [here](https://github.com/applicvision/frontend-friends/blob/main/docs/api/README.md).

## Development

Node.js 24 or later is required to run the tests.

```console
$ npm install
$ npm run node-test        # Node.js unit tests
$ npm run tdd              # Browser unit tests, in watch mode. Visit http://localhost:3000
$ npx playwright test      # Browser unit tests and end-to-end tests of the examples
```

The end-to-end tests in the `ci` folder start their own servers for the browser unit tests, the docs and the router example (`npm run serve-example`).
