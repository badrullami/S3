import assert from 'assert';
import crypto from 'crypto';

import bucketPut from '../../../lib/api/bucketPut';
import bucketPutCors from '../../../lib/api/bucketPutCors';
import { cleanup,
    DummyRequestLogger,
    makeAuthInfo }
from '../helpers';
import metadata from '../../../lib/metadata/wrapper';

const log = new DummyRequestLogger();
const authInfo = makeAuthInfo('accessKey1');
const bucketName = 'bucketname';
const locationConstraint = 'us-west-1';
const testBucketPutRequest = {
    bucketName,
    headers: { host: `${bucketName}.s3.amazonaws.com` },
    url: '/',
};
const sampleCors = [
  { allowedMethods: ['PUT', 'POST', 'DELETE'],
    allowedOrigins: ['http://www.example.com'],
    allowedHeaders: ['*'],
    maxAgeSeconds: 3000,
    exposeHeaders: ['x-amz-server-side-encryption'] },
  { allowedMethods: ['GET'],
    allowedOrigins: ['*'],
    allowedHeaders: ['*'],
    maxAgeSeconds: 3000 },
];

function _getPutCorsRequest(xml) {
    const request = {
        bucketName,
        headers: {
            host: `${bucketName}.s3.amazonaws.com`,
        },
        url: '/?website',
        query: { website: '' },
        post: xml,
    };
    request.headers['content-md5'] = crypto.createHash('md5')
        .update(request.post, 'utf8').digest('base64');
    return request;
}

function getCorsXml(arrayRules) {
    const xml = [];
    xml.push('<CORSConfiguration>');
    arrayRules.forEach(rule => {
        xml.push('<CORSRule>');
        ['allowedMethods', 'allowedOrigins', 'allowedHeaders', 'exposeHeaders']
        .forEach(elementArr => {
            if (rule[elementArr]) {
                const element = elementArr.charAt(0).toUpperCase() +
                elementArr.slice(1, -1);
                rule[elementArr].forEach(value => {
                    xml.push(`<${element}>${value}</${element}>`);
                });
            }
        });
        if (rule.id) {
            xml.push(`<ID>${rule.id}</ID>`);
        }
        if (rule.maxAgeSeconds) {
            xml.push(`<MaxAgeSeconds>${rule.maxAgeSeconds}</MaxAgeSeconds>`);
        }
        xml.push('</CORSRule>');
    });
    xml.push('</CORSConfiguration>');
    return xml.join('');
}


describe('putBucketCORS API', () => {
    beforeEach(done => {
        cleanup();
        bucketPut(authInfo, testBucketPutRequest,
        locationConstraint, log, done);
    });
    afterEach(() => cleanup());

    it('should update a bucket\'s metadata with cors resource', done => {
        const sampleXml = getCorsXml(sampleCors);
        const testBucketPutCorsRequest = _getPutCorsRequest(sampleXml);
        bucketPutCors(authInfo, testBucketPutCorsRequest, log, err => {
            if (err) {
                process.stdout.write(`Err putting website config ${err}`);
                return done(err);
            }
            return metadata.getBucket(bucketName, log, (err, bucket) => {
                if (err) {
                    process.stdout.write(`Err retrieving bucket MD ${err}`);
                    return done(err);
                }
                const uploadedCors = bucket.getCors();
                assert.deepStrictEqual(uploadedCors, sampleCors);
                return done();
            });
        });
    });
});
