/** @import {PluginStateShape, PluginCreator} from '../types/type-utils.d.ts' */

/**
 * @template {PluginStateShape} [State=undefined]
 * @param {PluginCreator<State>} pluginCreator
 **/
export function definePlugin(pluginCreator) {
	return pluginCreator
}
