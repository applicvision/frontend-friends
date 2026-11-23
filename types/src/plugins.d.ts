import { PluginCreator, PluginStateShape } from "../type-utils.js";

export function definePlugin<State extends PluginStateShape = undefined>
	(pluginCreator: PluginCreator<State>): PluginCreator<State>
