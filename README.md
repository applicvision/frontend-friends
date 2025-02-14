# Frontend Friends &nbsp;&nbsp;&nbsp; [![Tests](https://github.com/applicvision/frontend-friends/actions/workflows/test.yml/badge.svg)](https://github.com/applicvision/frontend-friends/actions/workflows/test.yml) [![NPM Version](https://img.shields.io/npm/v/%40applicvision%2Ffrontend-friends)](https://www.npmjs.com/package/@applicvision/frontend-friends) [![install size](https://packagephobia.com/badge?p=@applicvision/frontend-friends@latest)](https://packagephobia.com/result?p=@applicvision/frontend-friends@latest)



*Say hi to your new best friends for frontend development!*

Frontend friends offer a lightweight alternative to massive SPA-libraries. The humble wish is to provide you with a great developer experience as you navigate between declarative views, easy-to-follow state management, two-way bindings, effective list rendering, component authoring and interactive islands. All this with type hints, but without any build step or extra dependencies.



## Getting started

To get the best developer experience, install Frontend friends as an npm package.

```console
$ npm install @applicvision/frontend-friends
```

Then import it in your JavaScript.

```javascript
import { island, html } from '@applicvision/frontend-friends'

const app = island(
	() => html`<section>
			${['You', 'did', 'it!'].map(text => html`<p>${text}</p>`)}
		</section>`
)

app.mount(document.getElementById('app'))
```

Then to check it out in your browser you have two options; CDN or build tool.

### CDN
The easiest way to get started is to let your web page get the code from JSDeliver, and their nice [modules CDN](https://www.jsdelivr.com/esm).

First, add an importmap to your html-file. This tells the browser to fetch all imports of `@applicvision/frontend-friends` from esm.run, which is JSDeliver's modules CDN.

```html
<script type="importmap">
	{
		"imports": {
			"@applicvision/frontend-friends": "https://esm.run/@applicvision/frontend-friends",
			"@applicvision/frontend-friends/": "https://esm.run/@applicvision/frontend-friends/"
		}
	}
</script>
```

Then, add a script tag pointing to your application:

```html
<script type="module" src="main.js"></script>
````

And that's it! Now serve your files any way you like, and start building your web application, using modern technologies without any intermediate build tool.

*But why `npm install` if the code is fetched from CDN?*

Good question! It is not needed for the application to run in the browser, but it is highly recommended to get the correct developer experience. [Here](https://www.typescriptlang.org/docs/handbook/modules/guides/choosing-compiler-options.html#im-writing-es-modules-for-the-browser-with-no-bundler-or-module-compiler) is some more information.

### Build tool

Since Frontend friends is shipped as an npm package, it is naturally also possible to use in a build tool setup.
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
