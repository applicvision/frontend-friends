import { html, island } from '@applicvision/frontend-friends'
import { router } from '../router.js'
import { store } from '../store.js'

// The likes are kept in the store, in memory, so this island shows
// the books liked anywhere in the app since the page was loaded.
// The titles come from the books loaded by the routes.
export default island(() => {
	const favourites = store.likes.getAll().map(({ id }) => store.books.get(id))

	if (favourites.length == 0) {
		return html`<p>No favourites yet.</p>`
	}

	return html`
		<h3>Your favourites</h3>
		<ul aria-label="Favourites">${favourites.map(book => html.key(book.id)`
			<li><a href=${router.linkTo('books/:id', { id: book.id })}>${book.title}</a></li>`)}
		</ul>`
})
