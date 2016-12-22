export class CORSRule {
    // TODO: add parameters
    constructor(params) {
        if (params) {
            this._id = params.id;
            this._allowedMethods = params.allowedMethods;
            this._allowedOrigins = params.allowedOrigins;
            this._allowedHeaders = params.allowedHeaders;
            this._maxAgeSeconds = params.maxAgeSeconds;
            this._exposedHeaders = params.exposedHeaders;
        }
    }

    // TODO: Do I need a 'deserialize' or plain object method?

    /** Check value of ID to ensure it matches expected values.
    * @param {string} id - id to identify the rule
    * @return {Error|undefined} - error to return or parsed int
    */
    static validateID(id) {
        // TODO: Find out what kind of error & description to return
        // TODO: Are there other constraints on the ID?
        if (typeof id !== 'string') {
            return Error;
        }
        if (typeof id.length > 255) {
            return Error;
        }
        return undefined;
    }

    /** Check value of method to ensure it matches expected values.
    * @param {string} method - method to allow from cross-origin domains
    * @return {Error|undefined} - error to return
    */
    static validateAllowedMethod(method) {
        if (method !== 'GET' && method !== 'PUT' && method !== 'HEAD' &&
        method !== 'POST' && method !== 'DELETE') {
            // TODO: find out what error and customize description
            return Error;
        }
        return undefined;
    }

    /** Check value of origin to ensure it matches expected values.
    * @param {string} origin - origin to allow cross-origin requests from
    * @return {Error|undefined} - error to return
    */
    static validateAllowedOrigin(origin) {
        // TODO: Does it need to match rules about domains / IP addresses
        // or can it be any string?
        // TODO: determine types and messages of errors
        // NOTE: So far basically the same method as validateAllowedHeader
        if (typeof origin !== 'string') {
            return Error;
        }
        const numberWildcards = (origin.match(/\*/g) || []).length;
        if (numberWildcards > 1) {
            return Error;
        }
        return undefined;
    }

    /** Check value of allowed header to ensure it matches expected values.
    * @param {string} header - header to allow in OPTIONS request
    * @return {Error|undefined} - error to return
    */
    static validateAllowedHeader(header) {
        if (typeof header !== 'string') {
            // TODO: find out what error and customize description
            return Error;
        }
        const numberWildcards = (header.match(/\*/g) || []).length;
        if (numberWildcards > 1) {
            return Error;
        }
        return undefined;
    }

    /** Check value of max age seconds to ensure it matches expected values.
    * @param {string} value - number of seconds browser should cache response to
    *   ORIGIN request
    * @return {Error|number} - error to return
    */
    static validateMaxAgeSeconds(value) {
        const parsedValue = parseInt(value, 10);
        if (isNaN(parsedValue) || parsedValue < 0) {
            // TODO: find out what error and customize description
            return Error;
        }
        return parsedValue;
    }

    /** Check value of header to ensure it matches expected values.
    * @param {string} header - header to expose to applications
    * @return {Error|undefined} - error to return
    */
    static validateExposeHeader(header) {
        // TODO: Find out what kind of error & description to return
        // TODO: Are there other constraints on the header? Lowercase or no
        // symbols maybe?
        if (typeof header !== 'string') {
            return Error;
        }
        return undefined;
    }

    /** Get representation of class instance as plain object
    * @return {object} - plain object
    */
    getCORSRuleObj() {
        const corsRuleObj = {};
        // Must confirm this.keys will not return methods, only properties
        Object.keys(this).forEach(key => {
            corsRuleObj[key.slice(1)] = this[key];
        });
        return corsRuleObj;
    }

    /** Set ID
    * @param {string} id - String up to 255 characters long
    * @return {undefined}
    */
    setID(id) {
        this._id = id;
    }

    /** Get ID
    * @return {string} id
    */
    getID() {
        return this._id;
    }

    /** Add AllowedMethod to array of allowed methods
    * @param {string} method - GET, PUT, HEAD, POST or DELETE
    * @return {undefined}
    */
    addAllowedMethod(method) {
        if (!this._allowedMethods) {
            this._allowedMethods = [];
        }
        this._allowedMethods.push(method);
    }

    /** Get array of AllowedMethods
    * @return {string[]} - array of AllowedMethods
    */
    getAllowedMethods() {
        return this._allowedMethods;
    }

    /** Add AllowedOrigin to array of allowed origins
    * @param {string} origin - origin to accept requests from
    * @return {undefined}
    */
    addAllowedOrigin(origin) {
        if (!this._allowedOrigins) {
            this._allowedOrigins = [];
        }
        this._allowedOrigins.push(origin);
    }

    /** Get array of AllowedOrigins
    * @return {string[]} -array of AllowedOrigins
    */
    getAllowedOrigins() {
        return this._allowedOrigins;
    }

    /** Add AllowedHeader to array of allowed headers
    * @param {string} header - header to allow in OPTIONS request
    * @return {undefined}
    */
    addAllowedHeader(header) {
        if (!this._allowedHeaders) {
            this._allowedHeaders = [];
        }
        this._allowedHeaders.push(header);
    }

    /** Get array of AllowedHeaders
    * @return {string[]} - array of AllowedHeaders
    */
    getAllowedHeaders() {
        return this._allowedHeaders;
    }

    /** Set MaxAgeSeconds
    * @param {number} seconds - number of seconds browser should cache response
    *   to ORIGIN request
    * @return {undefined}
    */
    setMaxAgeSeconds(seconds) {
        this._maxAgeSeconds = seconds;
    }

    /** Get MaxAgeSeconds
    * @return {number} - MaxAgeSeconds
    */
    getMaxAgeSeconds() {
        return this._maxAgeSeconds;
    }

    /** Get array of AllowedMethods
    * @return {string[]} - array of AllowedMethods
    */
    getAllowedMethods() {
        return this._allowedMethods;
    }

    /** Add AllowedOrigin to array of allowed origins
    * @param {string} origin - origin to accept requests from
    * @return {undefined}
    */
    addAllowedOrigin(origin) {
        if (!this._allowedOrigins) {
            this._allowedOrigins = [];
        }
        this._allowedOrigins.push(origin);
    }

    /** Get array of AllowedOrigins
    * @return {string[]} -array of AllowedOrigins
    */
    getAllowedOrigins() {
        return this._allowedOrigins;
    }

    /** Add ExposedHeader to array of exposed headers
    * @param {string} header - header to expose to applications
    * @return {undefined}
    */
    addExposeHeader(header) {
        if (!this._exposedHeaders) {
            this._exposedHeaders = [];
        }
        this._exposedHeaders.push(header);
    }

    /** Get array of exposed headers
    * @return {string[]} - array of exposed headers
    */
    getExposeHeaders() {
        return this._exposedHeaders;
    }
}
