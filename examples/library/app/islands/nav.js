import { html, island } from '@applicvision/frontend-friends'
import { router } from '../router.js'

/** @type {[Parameters<typeof router.linkTo>[0], string][]} */
const links = [['', 'Home'], ['books', 'Books'], ['about', 'About']]

export default island(() => html`
	<nav aria-label="Main">
		<ul>${links.map(([path, label]) => html`
			<li>
				<a href=${router.linkTo(path)} aria-current=${router.isActive(path) ? 'page' : false}>${label}</a>
			</li>`)}
		</ul>
	</nav>`
)
