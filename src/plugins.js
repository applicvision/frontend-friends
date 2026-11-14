/** @import {PluginStateShape, PluginCreator, PluginFactory} from '../types/type-utils.d.ts' */

/**
 * @template {PluginStateShape} [State=undefined]
 * @param {PluginCreator<State>} pluginCreator
 * @return {PluginFactory<State>}
 **/
export function definePlugin(pluginCreator) {
	return (invalidatable, element) =>
		pluginCreator(invalidatable.invalidate.bind(invalidatable), element)
}
