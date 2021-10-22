import ConfigurationInterface from '../contract/UriConfigurationInterface';
import ParameterInterface from '../contract/UriParameterBinderConfigurationInterface';
export default class UriConfiguration implements ConfigurationInterface {
    readonly prependSlash: boolean;
    readonly parameters: ParameterInterface;
    constructor(config?: ConfigurationInterface);
}
