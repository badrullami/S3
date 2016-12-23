import { parseString } from 'xml2js';

import { errors } from 'arsenal';

/* Mocking up CORS object:
const cors = {
    id: 'string'
    allowedMethods: [],
    allowedOrigins: [],
    allowedHeaders: [],
    maxAgeSeconds: 60 (number),
    exposeHeaders = [],
} */

/*
    Format of xml request:

    <CORSConfiguration>
        <CORSRule>
            <AllowedOrigin>http://www.example.com</AllowedOrigin>
            <AllowedMethod>PUT</AllowedMethod>
            <AllowedMethod>POST</AllowedMethod>
            <AllowedMethod>DELETE</AllowedMethod>
            <AllowedHeader>*</AllowedHeader>
            <MaxAgeSeconds>3000</MaxAgeSec>
            <ExposeHeader>x-amz-server-side-encryption</ExposeHeader>
        </CORSRule>
        <CORSRule>
            <AllowedOrigin>*</AllowedOrigin>
            <AllowedMethod>GET</AllowedMethod>
            <AllowedHeader>*</AllowedHeader>
            <MaxAgeSeconds>3000</MaxAgeSeconds>
        </CORSRule>
    </CORSConfiguration>
*/

// What happens if I put functions in an object? Is it disadvantageous in some
// way? [EC]

const errs = {
    numberRules: 'The number of CORS rules should not exceed allowed limit ' +
    'of 100 rules.',
    originAndMethodExist: 'Each CORSRule must identify at least one origin ' +
    'and one method.',
};

const _utility = {
    validateID(id) {
        const errMsg = 'The ID value can be up to 255 characters long. ' +
        `Invalid ID is "${id}"`;
        if (!id) {
            return undefined;
        }
        if (!Array.isArray(id) || id.length !== 1
        || typeof id[0] !== 'string') {
            return errors.MalformedXML;
        }
        if (id[0] === '') {
            return undefined;
        }
        // NOTE: AWS does not make this check, but the spec specifies IDs should
        // be up to 255 characters in length.
        // http://docs.aws.amazon.com/AmazonS3/latest/API/RESTBucketPUTcors.html
        if (id[0].length > 255) {
            return errors.InvalidRequest.customizeDescription(errMsg);
        }
        return true; // to indicate ID exists
    },
    validateMaxAgeSeconds(seconds) {
        if (!seconds) {
            return undefined;
        }
        if (!Array.isArray(seconds) || seconds.length !== 1) {
            return errors.MalformedXML;
        }
        if (seconds[0] === '') {
            return undefined;
        }
        const parsedValue = parseInt(seconds[0], 10);
        const errMsg = `MaxAgeSeconds "${seconds[0]}" is not a valid value.`;
        if (isNaN(parsedValue) || parsedValue < 0) {
            return errors.MalformedXML.customizeDescription(errMsg);
        }
        return parsedValue;
    },
    validateNumberRules(length) {
        if (length > 100) {
            return errors.InvalidRequest.customizeDescription(errs.numberRules);
        }
        return undefined;
    },
    validateOriginAndMethodExist(allowedMethods, allowedOrigins) {
        if (allowedOrigins && allowedMethods &&
        Array.isArray(allowedOrigins) &&
        Array.isArray(allowedMethods) &&
        allowedOrigins.length > 0 &&
        allowedMethods.length > 0) {
            return undefined;
        }
        return errors.MalformedXML
            .customizeDescription(errs.originAndMethodExist);
    },
    validateMethods(methods) {
        let invalidMethod;
        function isValidMethod(method) {
            if (method !== 'GET' && method !== 'PUT' && method !== 'HEAD' &&
            method !== 'POST' && method !== 'DELETE') {
                invalidMethod = method;
                return false;
            }
            return true;
        }
        if (!methods.every(isValidMethod)) {
            const errMsg = 'Found unsupported HTTP method in CORS config. ' +
            `Unsupported method is "${invalidMethod}"`;
            return errors.InvalidRequest.customizeDescription(errMsg);
        }

        /* alternate code -- which is more readable?
        for (let i = 0; i < methods.length; i++) {
            const method = methods[i];
            const errMsg = 'Found unsupported HTTP method in CORS config. ' +
            `Unsupported method is "${method}"`;
            if (method !== 'GET' && method !== 'PUT' && method !== 'HEAD' &&
            method !== 'POST' && method !== 'DELETE') {
                return errors.InvalidRequest.customizeDescription(errMsg);
            }
        } */
        return undefined;
    },
    validateOrigins(origins) {
        for (let i = 0; i < origins.length; i++) {
            const origin = origins[i];
            const errMsg = `AllowedOrigin "${origin}" can not have ` +
            'more than one wildcard.';
            if (typeof origin !== 'string' || origin === '') {
                return errors.MalformedXML;
            }
            const numberWildcards = (origin.match(/\*/g) || []).length;
            if (numberWildcards > 1) {
                return errors.InvalidRequest.customizeDescription(errMsg);
            }
        }
        return undefined;
    },
    validateAllowedHeaders(headers) {
        if (!headers) {
            return undefined;
        }
        if (!Array.isArray(headers) || headers.length === 0) {
            return errors.MalformedXML;
        }
        for (let i = 0; i < headers.length; i++) {
            const header = headers[i];
            const errMsg = `AllowedHeader "${header}" can not have ` +
            'more than one wildcard.';
            if (typeof header !== 'string' || header === '') {
                return errors.MalformedXML;
            }
            const numberWildcards = (header.match(/\*/g) || []).length;
            if (numberWildcards > 1) {
                return errors.InvalidRequest.customizeDescription(errMsg);
            }
            // TODO: Consider adding validation for invalid symbols in header,
            // even if AWS does not
        }
        return true; // to indicate AllowedHeaders exists
    },
    validateExposeHeaders(headers) {
        if (!headers) {
            return undefined;
        }
        if (!Array.isArray(headers) || headers.length === 0) {
            return errors.MalformedXML;
        }
        for (let i = 0; i < headers.length; i++) {
            const header = headers[i];
            if (typeof header !== 'string') {
                return errors.MalformedXML;
            }
            if (header.indexOf('*') !== -1) {
                const errMsg = `ExposeHeader ${header} contains a wildcard. ` +
                'Wildcards are currently not supported for ExposeHeader.';
                return errors.InvalidRequest.customizeDescription(errMsg);
            }
            if (!/[A-Za-z0-9-]*/.test(header)) {
                const errMsg = `ExposeHeader ${header} contains invalid ` +
                'character.';
                return errors.InvalidRequest.customizeDescription(errMsg);
            }
        }
        return true; // indicate ExposeHeaders exists
    },
};

/** Validate XML, returning an error if any part is not valid
* @param {object[]} rules - CORSRule collection parsed from xml to be validated
* @return {(Error|object)} - return cors object on success; error on failure
* TODO: outline structure of expected rules object
*/
function _validateCorsXml(rules) {
    const cors = [];
    let result;

    if (rules.length > 100) {
        return errors.InvalidRequest.customizeDescription(errs.numberRules);
    }
    for (let i = 0; i < rules.length; i++) {
        const rule = rules[i];
        const corsRule = {};

        result = _utility.validateOriginAndMethodExist(rule.AllowedMethod,
            rule.AllowedOrigin);
        if (result instanceof Error) {
            return result;
        }

        result = _utility.validateMethods(rule.AllowedMethod);
        if (result instanceof Error) {
            return result;
        }
        corsRule.allowedMethods = rule.AllowedMethod;

        result = _utility.validateOrigins(rule.AllowedOrigin);
        if (result instanceof Error) {
            return result;
        }
        corsRule.allowedOrigins = rule.AllowedOrigin;

        result = _utility.validateID(rule.ID);
        if (result instanceof Error) {
            return result;
        } else if (result) {
            corsRule.id = rule.ID;
        }

        result = _utility.validateAllowedHeaders(rule.AllowedHeader);
        if (result instanceof Error) {
            return result;
        } else if (result) {
            corsRule.allowedHeaders = rule.AllowedHeader;
        }

        result = _utility.validateMaxAgeSeconds(rule.MaxAgeSeconds);
        if (result instanceof Error) {
            return result;
        } else if (result) {
            corsRule.maxAgeSeconds = result;
        }

        result = _utility.validateMaxAgeSeconds(rule.MaxAgeSeconds);
        if (result instanceof Error) {
            return result;
        } else if (result) {
            corsRule.maxAgeSeconds = result;
        }

        result = _utility.validateExposeHeaders(rule.ExposeHeader);
        if (result instanceof Error) {
            return result;
        } else if (result) {
            corsRule.exposeHeaders = rule.ExposeHeader;
        }

        cors.push(corsRule);
    }
    return cors;
}

export function parseCorsXml(xml, log, cb) {
    parseString(xml, (err, result) => {
        if (err) {
            log.trace('xml parsing failed', {
                error: err,
                method: 'parseCorsXml',
            });
            log.debug('invalid xml', { xmlObj: xml });
            return cb(errors.MalformedXML);
        }

        if (!result || !result.CORSConfiguration ||
            !result.CORSConfiguration.CORSRule ||
            !Array.isArray(result.CORSConfiguration.CORSRule)) {
            const errMsg = 'Invalid cors configuration xml';
            return cb(errors.MalformedXML.customizeDescription(errMsg));
        }

        const validationRes =
            _validateCorsXml(result.CORSConfiguration.CORSRule);
        if (validationRes instanceof Error) {
            log.debug('xml validation failed', {
                error: validationRes,
                method: '_validateCorsXml',
                xml,
            });
            return cb(validationRes);
        }
        // if no error, validation returns cors object
        console.log(validationRes);
        log.trace('cors configuration', { validationRes });
        return cb(null, validationRes);
    });
}

// console.log('=============================');
// console.log('jsonParsing Res', JSON.stringify(result, null, 4));
// console.log('=============================');

//    console.log('=============================');
//    console.log('rules', rules);
//    console.log('=============================');

//    console.log('=============================');
//    console.log('rules.length', rules.length);
//    console.log('=============================');

//  console.log('=============================');
//  console.log('corsRule', corsRule);
//  console.log('=============================');
