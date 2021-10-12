import Uri from './Uri'
import UriParameter from './UriParameter'
import UriParameterCollection from './UriParameterCollection'
import UriParameterBindingError from './error/UriParameterBindingError'
import TypeConversionError from './error/TypeConversionError'
import Configuration from './config/UriParameterBinderConfiguration'
import ConfigurationInterface from './contract/UriParameterBinderConfigurationInterface'

/**
 * Not part of the external API, use Uri as a wrapper
 *
 */
export default class UriParameterBinder
{
    private uri: string
    readonly parameters: UriParameterCollection
    readonly configuration: Configuration

    constructor(uri: string, config: ConfigurationInterface = {})
    {
        this.uri = uri
        this.configuration = new Configuration(config)
        this.parameters = UriParameterCollection.parseFromUri(uri.toString())
    }

    /**
     * Bind given values to the uri parameter placeholders
     *
     *  @throws UriParameterBindingError
     *
     */
    bind(values : any, config: ConfigurationInterface | null = null) : string
    {
        const configuration = config !== null ? new Configuration(config) : this.configuration

        // Return base uri if there's nothing to bind.
        if(this.parameters.length === 0 && configuration.bindGetParameters === false) {
            return this.uri
        }

        if(Array.isArray(values)) {
            return this.bindArray(this.uri, (values as Array<string>), configuration);
        }

        if(typeof values === 'object' && values !== null) {
            return this.bindObject(this.uri, values, configuration);
        }

        return this.bindValue(this.uri, values, configuration)
    }

    /**
     * Check if a given object has properties matching all required parameters
     *
     */
    canBindObject(object: object, config: ConfigurationInterface | null = null) : boolean
    {
        const configuration = config !== null ? new Configuration(config) : this.configuration

        try {
            this.bindObject(this.uri, object, configuration)
        }
        catch(error) {
            if(error instanceof UriParameterBindingError) {
                return false
            }
            throw error
        }

        return true
    }


    /**
     * Bind each object property to a to the parameter with a matching name.
     *
     */
    private bindObject(uri: string, object : object, config: Configuration) : string
    {
        this.parameters.forEach(parameter => {

            uri = this.bindParameter(uri, parameter, (object as any)[parameter.name], config)

            // Remove already bound values from the object's keys
            delete (object as any)[parameter.name];
        })

        // Bind rest of the parameters as get params if specified
        if(config.bindGetParameters) {
            uri = this.bindGetParameters(uri, object, config);
        }

        return uri
    }

    /**
     * Bind values in given order without caring about keys.
     *
     */
    private bindArray(uri: string, array: Array<any>, config: Configuration) : string
    {
        this.parameters.forEach((parameter, index) => {
            uri = this.bindParameter(uri, parameter, array[index], config)
        })

        return uri
    }

    /**
     * Bind a given plain value
     *
     */
    private bindValue(uri: string, value: any, config: Configuration) : string
    {
        const original = value
        const required = this.parameters.getRequired()

        if(required.length > 1) {
            const msg = `Cannot bind a given ${typeof value} as uri parameters: this type is handled as a plain value and can only be bound to one parameter but there are ${required.length} required parameters.`
            throw new UriParameterBindingError(msg)
        }

        return this.bindParameter(uri, this.parameters[0], value, config)
    }

    /**
     * Bind given object's properties as key value pairs for GET parameters
     *
     */
    private bindGetParameters(uri: string, values : object, config: Configuration) : string
    {
        for(const [key, value] of Object.entries(values)) {

            // Append the query indicator for first param
            if(uri === '') uri += '?';

            // For params after, start with &
            else uri += '&';

            // Append the key value pair
            uri += `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
        }

        return uri;
    }

    /**
     * Bind a single value to parameter of the given uri string
     *
     */
    private bindParameter(uri: string, parameter: string | UriParameter, value: any, config: Configuration) : string
    {
        const uriParameter = typeof parameter === 'string' ? this.parameters.getParameter(parameter) : parameter

        if(uriParameter === null) {
            const msg = `Cannot bind value to non-existent parameter '${parameter}'.`
            throw new UriParameterBindingError(msg)
        }

        if(value === undefined) {
            if(uriParameter.required) {
                const msg = `Cannot bind missing value for required parameter '${uriParameter.name}'.`
                throw new UriParameterBindingError(msg)
            }
            value = ''
        }

        const original = value

        try {
            value = this.convertToString(value)
        }
        catch(error) {
            if(error instanceof TypeConversionError) {
                const msg = `Cannot bind value for parameter '${uriParameter.name}', unable to convert ${typeof value} to string.`
                throw new UriParameterBindingError(msg, error)
            }
            throw error
        }

        if(uriParameter.required && value.length === 0) {

            if(typeof original === 'string') {
                const msg = `Cannot bind empty string for required parameter ${uriParameter.name}.`
                throw new UriParameterBindingError(msg)
            }

            const msg = `Cannot bind given ${typeof original} value for required parameter ${uriParameter.name} because string conversion results in an empty string.`
            throw new UriParameterBindingError(msg)
        }

        /* TODO use config */

        uri = uri.replace(uriParameter.placeholder, encodeURIComponent(value))
        uri = this.removeTrailingSlashes(uri)

        return uri
    }

    /**
     * Removes trailing slashes from a given string
     *
     */
    private removeTrailingSlashes(uri: string) : string
    {
        let lastChar = uri.slice(-1)

        while(lastChar === '/') {
            uri = uri.slice(0, -1)
            lastChar = uri.slice(-1)
        }

        return uri
    }

    /**
     * Convert a given value to string according to the configured parameter type conversion function
     *
     */
    private convertToString(value: any) : string
    {
        if(typeof value !== 'string') {
            value = this.configuration.typeConversionFunction(value)

            if(value === null) {
                const msg = 'String conversion failed'
                throw new UriParameterBindingError(msg)
            }
        }

        return value.trim()
    }
}
