import { PluginCreator, PluginFactory, PluginStateShape } from "../type-utils.js";

export function definePlugin<State extends PluginStateShape = undefined>
	(plugincreator: PluginCreator<State>): PluginFactory<State>
