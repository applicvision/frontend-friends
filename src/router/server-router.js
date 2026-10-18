import { Server, IncomingMessage, ServerResponse, OutgoingMessage } from 'node:http'
import path from 'node:path'
import { readFile, stat } from 'node:fs/promises'

import { BaseRouter, Route } from './base-router.js'
import { DynamicIsland } from '../dynamic-island.js'
import { parse } from '@applicvision/frontend-friends/parse-shape'
import { DynamicFragment, html } from '../dynamic-fragment.js'
import { pipeline } from 'node:stream/promises'
import { createReadStream } from 'node:fs'

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

/** @type {Record<string, string>} */
const contentTypes = {
	'.js': 'application/javascript',
	'.mjs': 'application/javascript',
	'.json': 'application/json',
	'.css': 'text/css',
	'.svg': 'image/svg+xml',
	'.html': 'text/html'
}

/** @param {string} file */
export function getContentType(file) {
	return contentTypes[path.extname(file)] ?? 'application/octet-stream'
}

/**
* @param {string} filePath 
* @return {Promise<import("node:http").OutgoingHttpHeaders>}
**/
async function contentHeaders(filePath) {
	const fileStats = await stat(filePath)
	if (fileStats.isDirectory()) {
		throw new Error('Unexpected directory')
	}
	return {
		'content-type': getContentType(filePath),
		'content-length': fileStats.size
	}
}



const islandContainerRegex = /<ff-island src="(?<islandSrc>[^"]+)">(?<islandContent>.*?)<\/ff-island>/sdg

const routerScriptTag = /<ff-router src="(?<src>[^"]+)"><\/ff-router>/

export class Router extends BaseRouter {

	/**
	* @param {string} filePath
	*/
	async #loadViewFile(filePath) {
		const resolvedFilePath = path.join(this.#fileDirectory, filePath)

		const extension = path.extname(resolvedFilePath)
		let view = ''
		if (extension == '.js' || extension == '.mjs') {
			const { default: defaultExport } = await import(resolvedFilePath)

			if (typeof defaultExport == 'string') {
				view = defaultExport
			} else if (typeof defaultExport == 'function') {
				view = await defaultExport(this.path)
			} else if (defaultExport instanceof DynamicFragment) {
				view = defaultExport.staticHtmlString
			}
			throw new Error('Invalid view content')
		} else {
			const fileContents = await readFile(resolvedFilePath)
			view = fileContents.toString()
		}

		// Normalize paths since we combine files

		const fileDirectory = path.dirname(resolvedFilePath)

		return view
			.replace(routerScriptTag, (match, src) => {
				if (src.startsWith('/')) {
					return match
				}
				const rewrittenSrc = path.join(fileDirectory, src)
				const startIndex = '<ff-router src="'.length

				return match.slice(0, startIndex) + rewrittenSrc + match.slice(startIndex + src.length)
			})
			.replaceAll(islandContainerRegex, (match, src) => {
				if (src.startsWith('/')) {
					return match
				}
				const rewrittenSrc = path.join(fileDirectory, src)

				const startIndex = '<ff-island src="'.length
				return match.slice(0, startIndex) + rewrittenSrc + match.slice(startIndex + src.length)
			})
	}

	/**
	 * @param {Route} route
	 * @param {Route} [stopAtRoute]
	 */
	async loadView(route, stopAtRoute) {
		// if (!this.route) throw new Error('Can not load view because there is no current route')

		const routesToLoad = []
		if (route.view) {
			routesToLoad.push({ route, viewFile: route.view })
		}

		/** @type {Route|null} */
		let currentRoute = route

		while (currentRoute && currentRoute != stopAtRoute) {
			const { layout } = currentRoute
			if (layout) {
				routesToLoad.unshift({ route: currentRoute, viewFile: layout })
			}
			currentRoute = currentRoute.parent
		}

		try {
			const views = await Promise.all(routesToLoad
				.map(async ({ route, viewFile }) => {
					const fileContent = await this.#loadViewFile(viewFile)
					return fileContent
						.replace(/<ff-outlet>.*?<\/ff-outlet>/,
							html`
						<ff-outlet owner="${route.fullPath}">
							<!-- ff-outlet-content -->
						</ff-outlet>`.staticHtmlString
						)
				}))

			return views.reduce((accumulatedView, view) => accumulatedView ? accumulatedView
				.replace("<!-- ff-outlet-content -->", view) : view
				, '')

		} catch (err) {
			console.log('Could not load view', err)
			throw err
		}
	}

	/**
	* @param {ServerResponse} response
	* @param {string|undefined} filePath
	*/
	async respondWithResource(response, filePath) {
		if (!filePath) return response.writeHead(404).end()
		if (path.relative(this.#fileDirectory, filePath).startsWith('..')) {
			return response.writeHead(403).end('No access')
		}
		try {
			response.writeHead(200, await contentHeaders(filePath))
		} catch (error) {
			if (/** @type {NodeJS.ErrnoException} */(error).code == 'ENOENT') {
				return response.writeHead(404).end()
			}
			return response.writeHead(400).end()
		}
		return pipeline(createReadStream(filePath), response)
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
	* @param {{route: Route, params: Record<string, string>, query: URLSearchParams}} routeMatch
	* @param {IncomingMessage} request
	*/
	loadRoute({ route, params, query }, request) {
		return route.load(
			(responseShape, input, init) =>
				typeof input == 'string' && !input.startsWith('http') ?
					this.#injectRequest(responseShape, input, request) :
					this.getJSON(responseShape, input, init)
			,
			params,
			query
		)
	}

	#fileDirectory = '.'


	/** @type {Server?} */
	#server = null
	/**
	* @param {{directory?: string}} [options]
	* @return {(request: IncomingMessage, response: ServerResponse, server: Server) => Promise<unknown>}
	*/
	mount(options) {

		const routerPattern = new URLPattern({ pathname: `${this.basePath}/_ff-router/:type(resource|view)/*` })

		this.#fileDirectory = options?.directory ?? '.'
		return async (request, response, server) => {
			this.#server ??= server
			if (request.url?.startsWith(this.basePath)) {
				const internalApiMatch = routerPattern.exec(request.url)
				if (internalApiMatch) {
					const { type, [0]: resource } = internalApiMatch.pathname.groups

					console.log('INCOMING REQUEST', { type, resource })

					// temp delay
					await new Promise(res => setTimeout(res, 200))

					if (type == 'view') {
						const searchParams = new URLSearchParams(internalApiMatch.search.input)
						const parent = searchParams.get('parent')
						const query = new URLSearchParams(searchParams.get('query') || undefined)
						const params = JSON.parse(searchParams.get('params') || '')

						// TODO: let base router make a map between path and route instead 
						const route = this.routes.find(route => route.path == resource)

						if (!route) return response.writeHead(404).end('No route found')

						const stopAtRoute = parent != null ? this.routes.find(route => route.path == parent) : undefined

						let responseHtml = await this.loadView(route, stopAtRoute)
						const routeData = await this.loadRoute({ route, params, query }, request)
						const islands = await this.#dynamicIslands(responseHtml)
						if (islands.length > 0) {
							this.setDataForRendering(route, routeData, params, query, () => {

								responseHtml = islands.reduceRight((view, { island, start, end }) => {
									return view.slice(0, start) +
										island.hydratable +
										view.slice(end)
								}, responseHtml)
							})
						}

						const data = {
							view: responseHtml,
							data: routeData
						}

						return response
							.writeHead(200, { 'content-type': 'application/json' })
							.end(JSON.stringify(data))
					}

					return this.respondWithResource(response, resource)
				}

				const routeMatch = this.resolve(request.url)

				if (!routeMatch) {
					return response.writeHead(404).end('Route not found')
				}

				try {
					let responseHtml = await this.loadView(routeMatch.route)
					const routeData = await this.loadRoute(routeMatch, request)
					const islands = await this.#dynamicIslands(responseHtml)
					if (islands.length > 0) {
						this.setDataForRendering(routeMatch.route, routeData, routeMatch.params, routeMatch.query, () => {

							responseHtml = islands.reduceRight((view, { island, start, end }) => {
								return view.slice(0, start) +
									island.hydratable +
									view.slice(end)
							}, responseHtml)
								.replace(routerScriptTag,
									(_, routerSrc) => this.#clientRouterScriptWithData(routerSrc)
								)
						})
					} else {
						responseHtml = responseHtml.replace(routerScriptTag,
							(_, routerSrc) => clientRouterScript(this.basePath, routerSrc)
						)
					}


					response.writeHead(200, { 'content-type': 'text/html' })
					response.end(responseHtml)
				} catch (err) {
					const error = /** @type {Error} */(err)
					response.writeHead(500)
					response.end(`<h2>Error rendering ${this.path}</h2><h3><pre>${error.message}</pre></h2><pre>${error.stack}</pre>`)
				}
			}
		}
	}

	/** 
	* @param {string} htmlString
	*/
	async #dynamicIslands(htmlString) {
		const foundIslands = htmlString.matchAll(islandContainerRegex)

		/** @type {{src: string, start: number, end: number}[]} */
		const islandsToLoad = []
		for (const foundIsland of foundIslands) {
			const { islandSrc } = foundIsland.groups ?? {}

			const [start, end] = foundIsland.indices?.groups?.islandContent ?? []

			start && end && islandsToLoad.push({
				src: islandSrc,
				start,
				end
			})
		}

		return Promise.all(islandsToLoad.map(async ({ src, start, end }) => {
			const [filePath, exportName = 'default'] = src.split('?')

			const module = await import(path.resolve(filePath))

			/** @type {DynamicIsland} */
			const island = module[exportName]

			return {
				island,
				start,
				end
			}
		}))
	}

	/** @param {string} routerSrc */
	#clientRouterScriptWithData(routerSrc) {

		const routeData = JSON.stringify({
			data: this.routeData,
			store: this.route?.store?.getAll()
		}, null, 2).replace(/</g, '\\u003c')

		return `
			<script id="ff-router-data" type="application/json">
			${routeData}
			</script>
			${clientRouterScript(this.basePath, routerSrc)}
		`.trim()

	}
}


/** 
* @param {string} base 
* @param {string} routerSrc
*/
function clientRouterScript(base, routerSrc) {
	const routerPath = path.join('/', base, '_ff-router/resource', routerSrc)
	return `
	<script type="module">
		import {router} from '${routerPath}'
		router.mount()
	</script>`.trim()
}

