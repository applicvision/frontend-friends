import { html, island } from '@applicvision/frontend-friends'
import { router } from '../router.js'
import { store } from '../store.js'

export default island(() => {
	// The liked books are loaded by the route. They are read through the store,
	// so that a book unliked after the page was loaded is left out.
	const favourites = (router.dataFor('') ?? [])
		.map(({ id }) => store.books.get(id))
		.filter(book => book.liked)

	if (favourites.length == 0) {
		return html`<p>No favourites yet.</p>`
	}

	return html`
		<h3>Your favourites</h3>
		<ul aria-label="Favourites">${favourites.map(book => html.key(book.id)`
			<li><a href=${router.linkTo('books/:id', { id: book.id })}>${book.title}</a></li>`)}
		</ul>`
})
