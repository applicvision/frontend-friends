import { IncomingMessage, Server, ServerResponse } from "node:http";
import { AllRoutes, BaseRouter, RouterSpec } from "./base-router.js"

export class Router<Routes> extends BaseRouter<Routes> {
	mount(options?: { viewDirectory?: string, transferToBrowser?: boolean }): (request: IncomingMessage, response: ServerResponse, server: Server) => Promise<unknown>

	static create<Spec extends RouterSpec<Spec>>(config: Spec): Router<AllRoutes<Spec>>
}
