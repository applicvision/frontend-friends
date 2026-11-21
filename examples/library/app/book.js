export class Book {
	/**
	 * Used as shape when loading books. See `@applicvision/frontend-friends/parse-shape`.
	 * @param {{ id: string, title: string, author: string, year: number, liked: boolean, summary?: string }} data
	 */
	constructor({ id, title, author, year, liked, summary }) {
		this.id = id
		this.title = title
		this.author = author
		this.year = year
		this.liked = liked
		// The book list does not include the summary.
		// Only set it when present, so that it is not cleared in the store when the list is loaded.
		if (summary) {
			this.summary = summary
		}
	}
}
