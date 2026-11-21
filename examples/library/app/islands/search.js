import { html, island } from '@applicvision/frontend-friends'
import { router } from '../router.js'

// A plain GET form. The browser router intercepts the submission
// as a navigation, so only the route data is reloaded.
// Without JavaScript, it works as an ordinary form.
export default island(() => html`
	<form action=${router.linkTo('books')} role="search">
		<input type="search" name="q" aria-label="Search books" placeholder="Title or author" value=${router.query.get('q') ?? ''}>
		<button>Search</button>
	</form>`
)
