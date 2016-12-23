import assert from 'assert';
import fs from 'fs';
import http from 'http';
import https from 'https';
import path from 'path';

import { S3 } from 'aws-sdk';

import conf from '../../../../../lib/Config';
import getConfig from '../support/config';
import { WebsiteConfigTester } from '../../lib/utility/website-util';

const config = getConfig('default', { signatureVersion: 'v4' });
const s3 = new S3(config);

const transport = conf.https ? 'https' : 'http';
const bucket = process.env.AWS_ON_AIR ? `awsbucketwebsitetester-${Date.now()}` :
    'bucketwebsitetester';
const hostname = `${bucket}.s3-website-us-east-1.amazonaws.com`;

const endpoint = process.env.AWS_ON_AIR ? `${transport}://${hostname}` :
    `${transport}://${hostname}:8000`;

const redirectEndpoint = conf.https ? 'https://www.google.com' :
    'http://www.google.com';

const redirectWaitingPeriod = 12000;

function putBucketWebsiteAndPutObjectRedirect(redirect, condition, key, done) {
    const webConfig = new WebsiteConfigTester('index.html');
    webConfig.addRoutingRule(redirect, condition);
    s3.putBucketWebsite({ Bucket: bucket,
        WebsiteConfiguration: webConfig }, err => {
        if (err) {
            done(err);
        }
        return s3.putObject({ Bucket: bucket,
        Key: key,
        ACL: 'public-read',
        Body: fs.readFileSync(path.join(__dirname,
            '/websiteFiles/redirect.html')),
        ContentType: 'text/html' }, done);
    });
}


/**
 * makeHeadRequest - makes head request and asserts expected response
 * @param {number} expectedStatusCode - expected response code
 * @param {object} expectedHeaders - expected headers in response with
 * expected values (e.g., {x-amz-error-code: AccessDenied})
 * @param {function} cb - callback to end test
 * @return {undefined}
 */
function makeHeadRequest(expectedStatusCode, expectedHeaders, cb) {
    const options = {
        hostname,
        port: process.env.AWS_ON_AIR ? 80 : 8000,
        method: 'HEAD',
        rejectUnauthorized: false,
    };
    const module = conf.https ? https : http;
    const req = module.request(options, res => {
        const body = [];
        res.on('data', chunk => {
            body.push(chunk);
        });
        res.on('error', err => {
            process.stdout.write('err on post response');
            return cb(err);
        });
        res.on('end', () => {
            console.log("res.headers!!", res.headers)
            // body should be empty
            assert.deepStrictEqual(body, []);
            assert.strictEqual(res.statusCode, expectedStatusCode);
            const headers = Object.keys(expectedHeaders);
            for (let i = 0; i < headers.length; i++) {
                assert.strictEqual(res.headers[headers[i]],
                    expectedHeaders[headers[i]]);
            }
            return cb();
        });
    });
    req.on('error', err => {
        process.stdout.write('err from post request');
        return cb(err);
    });
    req.end();
}
// TEST FOLLOWING BEHAVIOR:
//
//
// if error, respond like:
// HTTP/1.1 403 Forbidden
// Date: Wed, 21 Dec 2016 20:33:00 GMT
// Server: AmazonS3
// Transfer-Encoding: chunked
// x-amz-error-code: AccessDenied
// x-amz-error-message: Access Denied
// x-amz-id-2: HteVr4cPi9iddwUdAifVTxLZcidlh
// e1yxO6mtr1lqaGRSW/lZlQMGLbIztWOTUcDP3vMA6PwpNE=
// x-amz-request-id: FD4EA11DD16537F5
//
// if redirect, redirect should be same as get code
//
// if success, respond with meta headers like:
// HTTP/1.1 200 OK
// Content-Length: 314
// Content-Type: text/html
// Date: Wed, 21 Dec 2016 20:32:52 GMT
// ETag: "6af6552e24eb4bdcc83f1b227dfc3dda"
// Last-Modified: Fri, 02 Dec 2016 18:06:55 GMT
// Server: AmazonS3
// x-amz-id-2: o2wNnLjNiRhiL83ji34IeV5vLV/kXoIN+nzh41XE/cz7+
// 8C5P3O3SIRj7PYNmhhJqE2NyDA2h5g=
// x-amz-meta-somekey: mymetadata!!!
// x-amz-request-id: 89BBCC95D4738024
//
//
// if redirect rule for error and get error redirect like:
// called head with prefix zzz and got 403 so satisfied conditions for redirect
// HTTP/1.1 301 Moved Permanently
// Content-Length: 0
// Date: Thu, 22 Dec 2016 02:47:48 GMT
// Location: http://whatever.com.s3-website-us-east-1.amazonaws.com/zzz
// Server: AmazonS3
// x-amz-id-2: 5HXWYfdLQS8ZRBZJcKV1cxqxgKMTJzg74rGl61kRLA
// KX/MgqE4dZCJ4d9eF59Wbg/kza40cWcoA=
// x-amz-request-id: 0073330F58C7137C

// DELETE ME:
const browser = undefined;

describe('Head request on bucket website endpoint', () => {
    it('should return 404 when no such bucket', done => {
        const expectedHeaders = {
            'x-amz-error-code': 'NoSuchBucket',
            // Need arsenal fixed to remove period at the end
            // so compatible with aws
            'x-amz-error-message': 'The specified bucket does not exist.',
        };
        makeHeadRequest(404, expectedHeaders, done);
    });

    describe('with existing bucket', () => {
        beforeEach(done => s3.createBucket({ Bucket: bucket }, done));

        afterEach(done => s3.deleteBucket({ Bucket: bucket }, done));

        it('should return 404 when no website configuration', done => {
            const expectedHeaders = {
                'x-amz-error-code': 'NoSuchWebsiteConfiguration',
                'x-amz-error-message': 'The specified bucket does not ' +
                    'have a website configuration',
            };
            makeHeadRequest(404, expectedHeaders, done);
        });

        describe('with existing configuration', () => {
            beforeEach(done => {
                const webConfig = new WebsiteConfigTester('index.html');
                s3.putBucketWebsite({ Bucket: bucket,
                    WebsiteConfiguration: webConfig }, err => {
                    assert.strictEqual(err,
                        null, `Found unexpected err ${err}`);
                    s3.putObject({ Bucket: bucket, Key: 'index.html',
                        ACL: 'public-read',
                        Body: fs.readFileSync(path.join(__dirname,
                            '/websiteFiles/index.html')),
                        ContentType: 'text/html' },
                        err => {
                            assert.strictEqual(err, null);
                            done();
                        });
                });
            });

            afterEach(done => {
                s3.deleteObject({ Bucket: bucket, Key: 'index.html' },
                err => done(err));
            });

            console.log("continue here modifying tests for head requests!!")

            it('should serve indexDocument if no key requested', done => {
                browser.visit(endpoint, () => {
                    WebsiteConfigTester.checkHTML(browser, 'index-user');
                    done();
                });
            });
            it('should serve indexDocument if key requested', done => {
                browser.visit(`${endpoint}/index.html`, () => {
                    WebsiteConfigTester.checkHTML(browser, 'index-user');
                    done();
                });
            });
        });

        describe('with path in request with/without key', () => {
            beforeEach(done => {
                const webConfig = new WebsiteConfigTester('index.html');
                s3.putBucketWebsite({ Bucket: bucket,
                    WebsiteConfiguration: webConfig }, err => {
                    assert.strictEqual(err,
                        null, `Found unexpected err ${err}`);
                    s3.putObject({ Bucket: bucket,
                        Key: 'pathprefix/index.html',
                        ACL: 'public-read',
                        Body: fs.readFileSync(path.join(__dirname,
                            '/websiteFiles/index.html')),
                        ContentType: 'text/html' }, done);
                });
            });

            afterEach(done => {
                s3.deleteObject({ Bucket: bucket, Key:
                    'pathprefix/index.html' },
                done);
            });

            it('should serve indexDocument if path request without key',
            done => {
                browser.visit(`${endpoint}/pathprefix/`, () => {
                    WebsiteConfigTester.checkHTML(browser, 'index-user');
                    done();
                });
            });

            it('should serve indexDocument if path request with key',
            done => {
                browser.visit(`${endpoint}/pathprefix/index.html`, () => {
                    WebsiteConfigTester.checkHTML(browser, 'index-user');
                    done();
                });
            });
        });

        describe('with private key', () => {
            beforeEach(done => {
                const webConfig = new WebsiteConfigTester('index.html');
                s3.putBucketWebsite({ Bucket: bucket,
                    WebsiteConfiguration: webConfig }, err => {
                    assert.strictEqual(err,
                        null, `Found unexpected err ${err}`);
                    s3.putObject({ Bucket: bucket,
                        Key: 'index.html',
                        ACL: 'private',
                        Body: fs.readFileSync(path.join(__dirname,
                            '/websiteFiles/index.html')),
                        ContentType: 'text/html' }, done);
                });
            });

            afterEach(done => {
                s3.deleteObject({ Bucket: bucket, Key: 'index.html' }, done);
            });

            it('should return 403 if key is private', done => {
                browser.visit(endpoint, () => {
                    WebsiteConfigTester.checkHTML(browser, '403-access-denied');
                    done();
                });
            });
        });

        describe('with nonexisting index document key', () => {
            beforeEach(done => {
                const webConfig = new WebsiteConfigTester('index.html');
                s3.putBucketWebsite({ Bucket: bucket,
                    WebsiteConfiguration: webConfig }, done);
            });

            it('should return 403 if nonexisting index document key', done => {
                browser.visit(endpoint, () => {
                    WebsiteConfigTester.checkHTML(browser, '403-access-denied');
                    done();
                });
            });
        });

        describe(`redirect all requests to ${redirectEndpoint}`, () => {
            beforeEach(done => {
                const redirectAllTo = {
                    HostName: 'www.google.com',
                };
                const webConfig = new WebsiteConfigTester(null, null,
                  redirectAllTo);
                s3.putBucketWebsite({ Bucket: bucket,
                    WebsiteConfiguration: webConfig }, done);
            });

            it(`should redirect to ${redirectEndpoint}`, done => {
                browser.visit(endpoint, () => setTimeout(() => {
                    WebsiteConfigTester.checkHTML(browser, '200',
                      redirectEndpoint);
                    done();
                }, redirectWaitingPeriod));
            });

            it(`should redirect to ${redirectEndpoint}/about`, done => {
                browser.visit(`${endpoint}/about`, () => setTimeout(() => {
                    WebsiteConfigTester.checkHTML(browser, '200',
                      `${redirectEndpoint}/about/`);
                    done();
                }, redirectWaitingPeriod));
            });
        });

        describe('redirect all requests to https://www.google.com ' +
            'since https protocol set in website config', () => {
            // Note: these tests will all redirect to https even if
            // conf does not have https since protocol in website config
            // specifies https
            beforeEach(done => {
                const redirectAllTo = {
                    HostName: 'www.google.com',
                    Protocol: 'https',
                };
                const webConfig = new WebsiteConfigTester(null, null,
                  redirectAllTo);
                s3.putBucketWebsite({ Bucket: bucket,
                    WebsiteConfiguration: webConfig }, done);
            });

            it('should redirect to https://google.com', done => {
                browser.visit(endpoint, () => setTimeout(() => {
                    WebsiteConfigTester.checkHTML(browser, '200',
                      'https://www.google.com');
                    done();
                }, redirectWaitingPeriod));
            });

            it('should redirect to https://google.com/about', done => {
                browser.visit(`${endpoint}/about`, () => setTimeout(() => {
                    WebsiteConfigTester.checkHTML(browser, '200',
                      'https://www.google.com/about/');
                    done();
                }, redirectWaitingPeriod));
            });
        });

        describe('with custom error document', () => {
            beforeEach(done => {
                const webConfig = new WebsiteConfigTester('index.html',
                'error.html');
                s3.putBucketWebsite({ Bucket: bucket,
                    WebsiteConfiguration: webConfig }, err => {
                    assert.strictEqual(err,
                        null, `Found unexpected err ${err}`);
                    s3.putObject({ Bucket: bucket,
                        Key: 'error.html',
                        ACL: 'public-read',
                        Body: fs.readFileSync(path.join(__dirname,
                            '/websiteFiles/error.html')),
                        ContentType: 'text/html' }, done);
                });
            });

            afterEach(done => {
                s3.deleteObject({ Bucket: bucket, Key: 'error.html' }, done);
            });

            it('should serve custom error document if an error occurred',
            done => {
                browser.visit(endpoint, () => {
                    WebsiteConfigTester.checkHTML(browser, 'error-user');
                    done();
                });
            });
        });

        describe('unfound custom error document', () => {
            beforeEach(done => {
                const webConfig = new WebsiteConfigTester('index.html',
                'error.html');
                s3.putBucketWebsite({ Bucket: bucket,
                    WebsiteConfiguration: webConfig }, done);
            });

            it('should serve s3 error file if unfound custom error document ' +
            'and an error occurred', done => {
                browser.visit(endpoint, () => {
                    WebsiteConfigTester.checkHTML(browser,
                      '403-retrieve-error-document');
                    done();
                });
            });
        });

        describe('redirect to hostname with error code condition', () => {
            beforeEach(done => {
                const webConfig = new WebsiteConfigTester('index.html');
                const condition = {
                    HttpErrorCodeReturnedEquals: '403',
                };
                const redirect = {
                    HostName: 'www.google.com',
                };
                webConfig.addRoutingRule(redirect, condition);
                s3.putBucketWebsite({ Bucket: bucket,
                    WebsiteConfiguration: webConfig }, done);
            });

            it(`should redirect to ${redirectEndpoint} if error 403` +
            ' occured', done => {
                browser.visit(endpoint, () => setTimeout(() => {
                    WebsiteConfigTester.checkHTML(browser, '200',
                    redirectEndpoint);
                    done();
                }, redirectWaitingPeriod));
            });
        });

        describe('redirect to hostname with prefix condition', () => {
            beforeEach(done => {
                const webConfig = new WebsiteConfigTester('index.html');
                const condition = {
                    KeyPrefixEquals: 'about/',
                };
                const redirect = {
                    HostName: 'www.google.com',
                };
                webConfig.addRoutingRule(redirect, condition);
                s3.putBucketWebsite({ Bucket: bucket,
                    WebsiteConfiguration: webConfig }, done);
            });

            it(`should redirect to ${redirectEndpoint}/about if ` +
            'key prefix is equal to "about"', done => {
                browser.visit(`${endpoint}/about/`, () => setTimeout(() => {
                    WebsiteConfigTester.checkHTML(browser, '200',
                    `${redirectEndpoint}/about/`);
                    done();
                }, redirectWaitingPeriod));
            });
        });

        describe('redirect to hostname with prefix and error condition',
        () => {
            beforeEach(done => {
                const webConfig = new WebsiteConfigTester('index.html');
                const condition = {
                    KeyPrefixEquals: 'about/',
                    HttpErrorCodeReturnedEquals: '403',
                };
                const redirect = {
                    HostName: 'www.google.com',
                };
                webConfig.addRoutingRule(redirect, condition);
                s3.putBucketWebsite({ Bucket: bucket,
                    WebsiteConfiguration: webConfig }, done);
            });

            it(`should redirect to ${redirectEndpoint} if ` +
            'key prefix is equal to "about" AND error code 403', done => {
                browser.visit(`${endpoint}/about/`, () => setTimeout(() => {
                    WebsiteConfigTester.checkHTML(browser, '200',
                      `${redirectEndpoint}/about/`);
                    done();
                }, redirectWaitingPeriod));
            });
        });

        describe('redirect with multiple redirect rules', () => {
            beforeEach(done => {
                const webConfig = new WebsiteConfigTester('index.html');
                const conditions = {
                    KeyPrefixEquals: 'about/',
                };
                const redirectOne = {
                    HostName: 'www.google.com',
                };
                const redirectTwo = {
                    HostName: 's3.google.com',
                };
                webConfig.addRoutingRule(redirectOne, conditions);
                webConfig.addRoutingRule(redirectTwo, conditions);
                s3.putBucketWebsite({ Bucket: bucket,
                    WebsiteConfiguration: webConfig }, done);
            });

            it('should redirect to the first one', done => {
                browser.visit(`${endpoint}/about/`, () => setTimeout(() => {
                    WebsiteConfigTester.checkHTML(browser, '200',
                      `${redirectEndpoint}/about/`);
                    done();
                }, redirectWaitingPeriod));
            });
        });

        describe('redirect with protocol',
        () => {
            beforeEach(done => {
                const webConfig = new WebsiteConfigTester('index.html');
                const condition = {
                    KeyPrefixEquals: 'about/',
                };
                const redirect = {
                    Protocol: 'https',
                    HostName: 'www.google.com',
                };
                webConfig.addRoutingRule(redirect, condition);
                s3.putBucketWebsite({ Bucket: bucket,
                    WebsiteConfiguration: webConfig }, done);
            });

            it('should redirect to https://www.google.com/about if ' +
            'https protocols', done => {
                browser.visit(`${endpoint}/about/`, () => setTimeout(() => {
                    WebsiteConfigTester.checkHTML(browser, '200',
                      'https://www.google.com/about/');
                    done();
                }, redirectWaitingPeriod));
            });
        });

        describe('redirect to key using ReplaceKeyWith', () => {
            beforeEach(done => {
                const condition = {
                    HttpErrorCodeReturnedEquals: '403',
                };
                const redirect = {
                    ReplaceKeyWith: 'redirect.html',
                };
                putBucketWebsiteAndPutObjectRedirect(redirect, condition,
                  'redirect.html', done);
            });

            afterEach(done => {
                s3.deleteObject({ Bucket: bucket, Key: 'redirect.html' },
                err => done(err));
            });

            it('should serve redirect file if error 403 error occured',
            done => {
                browser.visit(endpoint, () => {
                    WebsiteConfigTester.checkHTML(browser, 'redirect-user');
                    done();
                });
            });
        });

        describe('redirect using ReplaceKeyPrefixWith', () => {
            beforeEach(done => {
                const webConfig = new WebsiteConfigTester('index.html');
                const condition = {
                    HttpErrorCodeReturnedEquals: '403',
                };
                const redirect = {
                    HostName: 'www.google.com',
                    ReplaceKeyPrefixWith: '/about',
                };
                webConfig.addRoutingRule(redirect, condition);
                s3.putBucketWebsite({ Bucket: bucket,
                    WebsiteConfiguration: webConfig }, done);
            });

            it(`should redirect to ${redirectEndpoint}/about if ` +
            'ReplaceKeyPrefixWith equals "/about"', done => {
                browser.visit(endpoint, () => setTimeout(() => {
                    WebsiteConfigTester.checkHTML(browser, '200',
                    `${redirectEndpoint}/about/`);
                    done();
                }, redirectWaitingPeriod));
            });
        });

        describe('redirect requests with prefix /about to redirect/',
        () => {
            beforeEach(done => {
                const condition = {
                    KeyPrefixEquals: 'about/',
                };
                const redirect = {
                    ReplaceKeyPrefixWith: 'redirect/',
                };
                putBucketWebsiteAndPutObjectRedirect(redirect, condition,
                  'redirect/index.html', done);
            });

            afterEach(done => {
                s3.deleteObject({ Bucket: bucket, Key: 'redirect/index.html' },
                err => done(err));
            });

            it('should serve redirect file if key prefix is equal to "about"',
            done => {
                browser.visit(`${endpoint}/about/`, () => {
                    WebsiteConfigTester.checkHTML(browser, 'redirect-user');
                    done();
                });
            });
        });

        describe('redirect requests, with prefix /about and that return ' +
        '403 error, to prefix redirect/', () => {
            beforeEach(done => {
                const condition = {
                    KeyPrefixEquals: 'about/',
                    HttpErrorCodeReturnedEquals: '403',
                };
                const redirect = {
                    ReplaceKeyPrefixWith: 'redirect/',
                };
                putBucketWebsiteAndPutObjectRedirect(redirect, condition,
                  'redirect/index.html', done);
            });

            afterEach(done => {
                s3.deleteObject({ Bucket: bucket, Key: 'redirect/index.html' },
                err => done(err));
            });

            it('should serve redirect file if key prefix is equal to ' +
            '"about" and error 403',
            done => {
                browser.visit(`${endpoint}/about/`, () => {
                    WebsiteConfigTester.checkHTML(browser, 'redirect-user');
                    done();
                });
            });
        });
    });
});
