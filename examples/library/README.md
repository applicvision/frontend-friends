# Library – router example

A small server-rendered app built with the Frontend Friends router, where you can browse, search, sort and like books. It is also the test app for the end-to-end tests in [`ci/router.spec.js`](../../ci/router.spec.js).

Run it from the root of the repository (Node.js 24 or later):

```console
$ npm install
$ npm run serve-example
```

Then visit http://localhost:3002.

## Structure

```
server.js           Node.js server for the API, the library and the router
api.js              A small JSON API with books
app/
  router.js         The routes, used both on the server and in the browser
  store.js          The store, shared by routes and islands
  book.js           The Book class, also used as shape for the loaded data
  *.html            Layouts and views
  islands/          The islands
```

The example uses the library source of the repository, through the import map in `app/layout.html`. In a real project, the import map would point to a CDN, such as esm.sh.
