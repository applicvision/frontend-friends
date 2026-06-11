import { Server, IncomingMessage, ServerResponse } from 'node:http'
import path from 'node:path'
import { readFile } from 'node:fs/promises'

import { BaseRouter, Route } from './base-router.js'
import { serialize } from '../store.js'
import { DynamicIsland } from '../dynamic-island.js'
import { parse } from '@applicvision/frontend-friends/parse-shape'
import { DynamicFragment, html } from '../dynamic-fragment.js'

/**
 * @import {getStore} from '../store.js'
 * @typedef {ReturnType<getStore>} StoreObject
 */

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

export class Router extends BaseRouter {

	/**
	 * @param {string} filePath
	 */
	async #loadViewFile(filePath) {
		const extension = path.extname(filePath)
		if (extension == '.js' || extension == '.mjs') {
			const { default: defaultExport } = await import(filePath)
			let view = defaultExport
			if (typeof defaultExport == 'function') {
				view = await defaultExport(this.path)
			}
			if (typeof view == 'string') {
				return view
			}
			if (view instanceof DynamicFragment) {
				return view.staticHtmlString
			}
			throw new Error('Invalid view content')
		} else {
			const fileContents = await readFile(filePath)
			return fileContents.toString()
		}
	}

	get #browserTransfer() {
		return html`
		<!-- router-data-start -->
		<script id="routedata" type="application/json">${JSON.stringify(this.routeData, null, 2) ?? ''}</script>
		<!-- router-data-end -->
		`
	}

	/**
	 * @param {Route} [stopAtRoute]
	 */
	async loadView(stopAtRoute) {
		// if (!this.route) throw new Error('Can not load view because there is no current route')

		/** @type {string[]} */
		const viewFiles = []

		if (this.route?.view) {
			viewFiles.push(this.route.view)
		}

		let route = this.route

		while (route && route != stopAtRoute) {
			const useView = route == this.route ? route.view : route.layout
			if (route.layout) {
				viewFiles.push(route.layout)
			}
			route = route.parent
		}

		try {
			const views = await Promise.all(viewFiles.map(file => this.#loadViewFile(path.join(this.#viewDirectory, file))))
			return views.reduceRight((parentsView, view, index) => parentsView ? parentsView
				.replace(
					/<router-outlet>.*?<\/router-outlet>/,
					html`
					${index == 0 && this.#transferToBrowser ? this.#browserTransfer : ''}
					<!-- router-outlet-start -->
					${view}
					<!-- router-outlet-end -->
					`.staticHtmlString
				) : view
				, '')

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
	loadRoute(request) {
		return this.route?.load(
			(responseShape, input, init) =>
				typeof input == 'string' && !input.startsWith('http') ?
					this.#injectRequest(responseShape, input, request) :
					this.getJSON(responseShape, input, init)
			,
			this.params,
			this.query
		)
	}

	#viewDirectory = '.'

	#mountPath = '/'

	#transferToBrowser = false

	/** @type {Server?} */
	#server = null
	/**
	 * @param {{viewDirectory?: string, transferToBrowser?: boolean}} [options]
	 * @return {(request: IncomingMessage, response: ServerResponse, server: Server) => Promise<unknown>}
	 */
	mount(options) {

		this.#viewDirectory = options?.viewDirectory ?? '.'
		this.#transferToBrowser = options?.transferToBrowser ?? false
		return async (request, response, server) => {
			this.#server ??= server
			if (request.url?.startsWith(this.basePath)) {

				console.log('in router', request.url)

				if (request.url.startsWith(`${this.basePath}/__view`)) {
					console.log('TODO: handle async view request')
					response.writeHead(200)
					response.end('<h1>asdasd</h1>')
					return
				}

				if (this.resolve(request.url)) {
					try {
						this.setCurrentRouteData(await this.loadRoute(request))
						const responseHtml = await this.loadView()
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

	/** @param {string} routerLocation */
	async #buildHtml(routerLocation) {
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

			const { [exportName]: island } = await import(path.resolve(this.#viewDirectory, filePath))
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
			import router from '${routerLocation}'
			router.mount('${this.path}')
		</script>
		`
	}
}
