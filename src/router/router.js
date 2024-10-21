import { BaseRouter } from './base-router.js'
import path from 'path'
import { clearStore, serialize } from '../store.js'
import { readFile } from 'fs/promises'
import { DynamicIsland } from '../dynamic-island.js'
import { Server, IncomingMessage } from 'http'
import { Writable } from 'stream'
import { finished } from 'stream/promises'
import { parse } from '@applicvision/frontend-friends/parse-shape'

class FakeResponse extends Writable {
	#text = ''

	/**
	 * @param {string} chunk
	 * @param {BufferEncoding} encoding
	 * @param {(error?: Error) => void} callback
	 */
	_write(chunk, encoding, callback) {
		this.#text += chunk
		callback()
	}

	get json() {
		return JSON.parse(this.#text)
	}

	writeHead() {
		if (this.headersSent) {
			throw new Error('FakeResponse, headers already sent')
		}
		this.headersSent = true
	}
}

const islandContainerRegex = /<dynamic-island href="(?<islandHref>.+?)">(.*?)<\/dynamic-island>/sdg

/** @extends BaseRouter<any> */
export class Router extends BaseRouter {

	/**
	 * @param {string} view
	 */
	async #loadViewFile(view) {
		const fileContents = await readFile(path.join(this.viewDirectory, view))
		return fileContents.toString()
	}

	async loadView() {
		if (!this.route) throw new Error('Can not load view because there is no current route')

		/** @type {string[]} */
		const viewFiles = []
		if (this.baseView) {
			viewFiles.push(this.baseView)
		}
		viewFiles.push(...this.route.parentChain.map(route => route.view))
		viewFiles.push(this.route.view)

		try {
			const views = await Promise.all(viewFiles.map(file => this.#loadViewFile(file)))
			return views.reduce((parentsView, view, index) => parentsView
				.replace(
					'<router-outlet></router-outlet>',
					`<router-outlet owner="${viewFiles[index - 1]}">${view}</router-outlet>`
				)
			)

		} catch (err) {
			console.log('Could not load view', err)
			throw err
		}
	}

	/**
	 * @template T
	 * @param {T} responseShape
	 * @param {string} url
	 * @param {IncomingMessage} request
	 */
	async #fakeGetRequest(responseShape, url, request) {
		const response = new FakeResponse()
		this.#server?.emit('request', { url, method: 'GET' }, response)
		await finished(response)
		return parse(responseShape, response.json)
	}

	/**
	 * @param {IncomingMessage} request
	 */
	async loadRoute(request) {
		await this.route?.load(
			(responseShape, input, init) =>
				typeof input == 'string' ?
					this.#fakeGetRequest(responseShape, input, request) :
					this.getJSON(responseShape, input, init)
			,
			this.params,
			this.query
		)
	}

	/** @type {Server?} */
	#server = null
	/**
	 * @param {Server} server
	 * @param {string} path
	 */
	mount(server, path = '/') {
		this.#server = server
		server.on('request', async (request, response) => {
			if (request.url?.startsWith(path)) {
				if (response.writableEnded || response.headersSent) {
					console.log('Response has been sent', request.url)
					return
				}
				console.log('Router got request', request.url)
				if (this.resolve(request.url)) {
					clearStore(this.store)
					response.writeHead(200, { 'content-type': 'text/html' })
					await this.loadRoute(request)
					try {
						const responseHtml = await this.render()
						response.end(responseHtml)
					} catch (error) {
						// TODO: need to remove writeHead for this to work
						response.statusCode = 500
						if (error instanceof Error) {
							response.end(`<h2>Error rendering ${this.path}</h2><h3><pre>${error.message}</pre></h2><pre>${error.stack}</pre>`)
						} else {
							response.end(`<h2>Unknown rendering error</h2><pre>${error}</pre>`)
						}
					}
				} else {
					response.writeHead(404)
					response.end('Route not found')
				}
			}
		})
	}

	async render() {
		const view = await this.loadView()
		const foundIslands = view.matchAll(islandContainerRegex)

		/** @type {{href: string, start: number, end: number}[]} */
		const islandsToLoad = []
		for (const foundIsland of foundIslands) {
			const { islandHref } = foundIsland.groups ?? {}

			const [start, end] = foundIsland.indices?.at(-1) ?? []
			start && end && islandsToLoad.push({
				href: islandHref,
				start,
				end
			})
		}

		const islandsHtml = await Promise.all(islandsToLoad.map(async islandPath => {
			const [filePath, exportName = 'default'] = islandPath.href.split('?')

			const { [exportName]: island } = await import(path.join(this.viewDirectory, filePath))
			// TODO: resolve files using some config for public directory
			/** @type {{default: DynamicIsland<any>}} */
			return island.hydratable

		}))

		const viewWithIslands = islandsHtml.reduceRight((view, island, index) => {
			return view.slice(0, islandsToLoad[index].start) + island + view.slice(islandsToLoad[index].end)
		}, view)

		return viewWithIslands + String.raw`
		<script id="routedata" type="application/json">${JSON.stringify({
			route: this.route?.data,
			store: serialize(this.store)
		}, null, 2)}</script>
		<script type="module">
			import router from '${this.routerLocation}'
			router.mount('${this.path}')
		</script>
		`
	}
}
