import { AllRoutes, BaseRouter, RouterSpec } from "./base-router.js"

export class Router<Routes> extends BaseRouter<Routes> {
	mount(options?: { base?: string }): Promise<void>

	static create<Spec extends RouterSpec<Spec>>(config: Spec): Router<AllRoutes<Spec>>
}
