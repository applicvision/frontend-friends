import { Server, IncomingMessage, ServerResponse } from 'node:http'
import path from 'node:path'
import { readFile } from 'node:fs/promises'

import { BaseRouter } from './base-router.js'
import { clearStore, serialize } from '../store.js'
import { DynamicIsland } from '../dynamic-island.js'
import { parse } from '@applicvision/frontend-friends/parse-shape'

class FakeResponse extends ServerResponse {
	#text = ''

	/** @type {Function?} */
	#resolveCompleted = null
	completed = new Promise((resolve) => {
		this.#resolveCompleted = resolve
	})

	/**
	 * @param {any} chunk
	 * @param {BufferEncoding | ((error?: Error | null) => void)} [encoding]
	 * @param {(error?: Error | null) => void} [callback]
	 * @returns {boolean}
	 */
	write(chunk, encoding, callback) {

		this.#text += chunk.toString()
		if (typeof callback == 'function') callback()
		else if (typeof encoding == 'function') encoding()

		return true
	}

	/**
	 * @param {any | (() => void)} [chunk]
	 * @param {BufferEncoding | (() => void)} [encoding]
	 * @param {() => void} [callback]
	 * @returns {this}
	 */
	end(chunk, encoding, callback) {

		if (chunk && (typeof chunk === 'string' || Buffer.isBuffer(chunk))) {
			this.#text += chunk.toString()
		}

		if (typeof callback === 'function') callback()
		else if (typeof encoding === 'function') encoding()

		this.#resolveCompleted?.()

		return this
	}

	get json() {
		return JSON.parse(this.#text)
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
	async #injectRequest(responseShape, url, request) {
		const originalUrl = request.url
		request.url = url

		const response = new FakeResponse(request)

		this.#server?.emit('request', request, response)
		await response.completed
		request.url = originalUrl
		return parse(responseShape, response.json)
	}

	/**
	 * @param {IncomingMessage} request
	 */
	async loadRoute(request) {
		await this.route?.load(
			(responseShape, input, init) =>
				typeof input == 'string' && !input.startsWith('http') ?
					this.#injectRequest(responseShape, input, request) :
					this.getJSON(responseShape, input, init)
			,
			this.params,
			this.query
		)
	}

	/** @type {Server?} */
	#server = null
	/**
	 * @param {string} path
	 * @return {(request: IncomingMessage, response: ServerResponse, server: Server) => Promise<void>}
	 */
	mount(path = '/') {
		return async (request, response, server) => {
			this.#server ??= server
			if (request.url?.startsWith(path)) {

				if (this.resolve(request.url)) {
					clearStore(this.store)
					try {
						await this.loadRoute(request)
						const responseHtml = await this.render()
						response.writeHead(200, { 'content-type': 'text/html' })
						response.end(responseHtml)
					} catch (err) {
						const error = /** @type {Error} */(err)
						response.writeHead(500)
						response.end(`<h2>Error rendering ${this.path}</h2><h3><pre>${error.message}</pre></h2><pre>${error.stack}</pre>`)
					}
				} else {
					response.writeHead(404)
					response.end('Route not found')
				}
			}
		}
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

			const { [exportName]: island } = await import(path.resolve(this.viewDirectory, filePath))
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
