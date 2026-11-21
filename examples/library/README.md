# Library – router example

A small server-rendered application built with the Frontend Friends router. It is also the test application for the end-to-end tests in [`ci/router.spec.js`](../../ci/router.spec.js).

Run it from the root of the repository (Node.js 24 or later):

```console
$ npm install
$ npm run serve-example
```

Then visit http://localhost:3002. Set the `PORT` environment variable to use another port.

## What it shows

| Route | Files | Shows |
| --- | --- | --- |
| `/` | `layout.html`, `home.html` | Root layout with a navigation island using `router.isActive`, and the liked books loaded by the route |
| `/about` | `about.html` | A plain view without islands or data |
| `/books` | `books/layout.html`, `books/list.html` | A nested layout, data loading, and query parameters for search (`q`) and sort order (`sort`) |
| `/books/:id` | `books/book.html` | Route parameters and data, and likes shared with the other views through the store |

Likes are saved by the API, per visitor, using a session cookie. When a book is liked, the response is upserted into the store, so every island showing the book is updated.

## Structure

```
server.js           Node.js server: API, library modules and the router
api.js              A small JSON API with books and likes
app/
  router.js         The routes. Used both on the server and in the browser
  store.js          Store for books, shared by routes and islands
  book.js           The Book class, also used as shape for the loaded data
  layout.html       Root layout, with import map, <ff-outlet> and <ff-router>
  *.html            Views and layouts
  islands/          Island modules, rendered on the server and hydrated in the browser
```

The import map in `app/layout.html` maps `@applicvision/frontend-friends` to `/lib`. The server resolves the module specifiers using the `exports` of the repository's `package.json`, picking the browser version of the router, so the example always uses the current source. In a real project, the import map would point to a CDN, such as esm.sh, instead.
