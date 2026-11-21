export class Book {
	/**
	 * Used as shape when loading books. See `@applicvision/frontend-friends/parse-shape`.
	 * @param {{ id: string, title: string, author: string, year: number, summary?: string }} data
	 */
	constructor({ id, title, author, year, summary }) {
		this.id = id
		this.title = title
		this.author = author
		this.year = year
		// The book list does not include the summary.
		// Only set it when present, so that it is not cleared in the store when the list is loaded.
		if (summary) {
			this.summary = summary
		}
	}
}

/** A book liked by the user. Likes are only kept in the browser. */
export class Like {
	/** @param {string} id The id of the book */
	constructor(id) {
		this.id = id
	}
}
