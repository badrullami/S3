import assert from 'assert';
import fs from 'fs';
import http from 'http';
import path from 'path';
const AWS = require('aws-sdk');

// import { S3 } from 'aws-sdk';
import Browser from 'zombie';

import conf from '../../../../../lib/Config';
// import getConfig from '../support/config';
import { WebsiteConfigTester } from '../../lib/utility/website-util';

// const config = getConfig('default', { signatureVersion: 'v4' });
// const s3 = new S3(config);

// against real AWS
const s3 = new AWS.S3({
    accessKeyId: process.env.A,
    secretAccessKey: process.env.S,
    endpoint: 's3.amazonaws.com',
    sslEnabled: false,
    s3ForcePathStyle: true,
    signatureVersion: 'v4',
});

const transport = conf.https ? 'https' : 'http';
const bucket = 'mybucketwebsite';
const hostname = `${bucket}.s3-website-us-east-1.amazonaws.com`;

// const endpoint = `${transport}://${hostname}:8000`;
const endpoint = `${transport}://${hostname}:80`;

// TODO: Add this endpoint in Integration for CI

describe('User visits bucket website endpoint', () => {
    const browser = new Browser();

    // Have not manage to reproduce that using postman for ex
    it.skip('should return 405 when user requests method other than get or head',
        done => {
            const options = {
                hostname,
                // port: 8000
                port: 80,
                method: 'POST',
            };
            const req = http.request(options, res => {
                const body = [];
                res.on('data', chunk => {
                    body.push(chunk);
                });
                res.on('end', () => {
                    assert.strictEqual(res.statusCode, 405);
                    const total = body.join('');
                    assert(total.indexOf('<head><title>405 ' +
                        'Method Not Allowed</title></head>') > -1);
                    done();
                });
            });
            req.end();
        });

    it('should return 404 when no such bucket', done => {
        browser.visit(endpoint, () => {
            WebsiteConfigTester.checkHTML(browser, '404-no-such-bucket',
              bucket);
            done();
        });
    });

    describe('with existing bucket', () => {
        beforeEach(done => {
            // s3.createBucket({ Bucket: bucket }, err => done(err));
            s3.createBucket({ Bucket: bucket }, err => {
                if (err) {
                    return done(err);
                }
                return setTimeout(() => done(), 5000);
            });
        });

        afterEach(done => {
            s3.deleteBucket({ Bucket: bucket }, err => done(err));
        });

        it('should return 404 when no website configuration', done => {
            browser.visit(endpoint, () => {
                WebsiteConfigTester.checkHTML(browser,
                  '404-no-such-website-configuration', bucket);
                done();
            });
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

            it('should serve indexDocument if no key requested', done => {
                browser.visit(endpoint, () => {
                    WebsiteConfigTester.checkHTML(browser, 'index-user');
                    done();
                });
            });
        });
        describe('with path in request without key', () => {
            beforeEach(done => {
                const webConfig = new WebsiteConfigTester('index.html');
                s3.putBucketWebsite({ Bucket: bucket,
                    WebsiteConfiguration: webConfig }, err => {
                    assert.strictEqual(err,
                        null, `Found unexpected err ${err}`);
                    s3.putObject({ Bucket: bucket,
                        Key: 'www/index.html',
                        ACL: 'public-read',
                        Body: fs.readFileSync(path.join(__dirname,
                            '/websiteFiles/index.html')),
                        ContentType: 'text/html' }, done);
                });
            });

            afterEach(done => {
                s3.deleteObject({ Bucket: bucket, Key: 'www/index.html' },
                done);
            });

            it('should serve indexDocument if path request without key',
            done => {
                browser.visit(`${endpoint}/www`, () => {
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

        describe('with no key', () => {
            beforeEach(done => {
                const webConfig = new WebsiteConfigTester('index.html');
                s3.putBucketWebsite({ Bucket: bucket,
                    WebsiteConfiguration: webConfig }, done);
            });

            it('should return 403 if no key', done => {
                browser.visit(endpoint, () => {
                    WebsiteConfigTester.checkHTML(browser, '403-access-denied');
                    done();
                });
            });
        });

        describe('redirect all requests to http://www.scality.com', () => {
            beforeEach(done => {
                const redirectAllTo = {
                    HostName: 'www.scality.com',
                };
                const webConfig = new WebsiteConfigTester(null, null,
                  redirectAllTo);
                s3.putBucketWebsite({ Bucket: bucket,
                    WebsiteConfiguration: webConfig }, done);
            });

            it('should redirect to http://www.scality.com', done => {
                browser.visit(endpoint, () => {
                    WebsiteConfigTester.checkHTML(browser, 'scality');
                    done();
                });
            });

            it('should redirect to http://www.scality.com/about-us', done => {
                browser.visit(`${endpoint}/about-us`, () => {
                    WebsiteConfigTester.checkHTML(browser, 'scality-about-us');
                    done();
                });
            });
        });

        // If redirectAllTo protocol return an http (not https) request,
        // this test will fail.
        describe('redirect all requests to https://scality.com', () => {
            beforeEach(done => {
                const redirectAllTo = {
                    HostName: 'scality.com',
                    Protocol: 'https',
                };
                const webConfig = new WebsiteConfigTester(null, null,
                  redirectAllTo);
                s3.putBucketWebsite({ Bucket: bucket,
                    WebsiteConfiguration: webConfig }, done);
            });

            it('should redirect to http://scality.com', done => {
                browser.visit(endpoint, () => {
                    WebsiteConfigTester.checkHTML(browser, 'scality');
                    done();
                });
            });

            it('should redirect to https://scality.com/about-us', done => {
                browser.visit(`${endpoint}/about-us`, () => {
                    WebsiteConfigTester.checkHTML(browser, 'scality-about-us');
                    done();
                });
            });
        });

        describe('with user\'s error', () => {
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

            it('should serve user\'s error file if an error occurred', done => {
                browser.visit(endpoint, () => {
                    WebsiteConfigTester.checkHTML(browser, 'error-user');
                    done();
                });
            });
        });

        describe('error with unfound user\'s error', () => {
            beforeEach(done => {
                const webConfig = new WebsiteConfigTester('index.html',
                'error.html');
                s3.putBucketWebsite({ Bucket: bucket,
                    WebsiteConfiguration: webConfig }, done);
            });

            it('should serve s3 error file if unfound user\'s error file ' +
            'and an error occurred', done => {
                browser.visit(endpoint, () => {
                    WebsiteConfigTester.checkHTML(browser,
                      '403-retrieve-error-document');
                    done();
                });
            });
        });
    });
});

// Tests:
// 1) website endpoint method other than get or head X
// 2) website endpoint without a bucket name (would need separate etc/hosts
// entry -- SKIP it)
// 3) no such bucket X
// 4) no website configuration X
// 5) no key in request -- uses index document X
// 6) path in request without key (for example: docs/) -- uses index document
//  a) put website config like in prior test
//  b) put key called docs/index.html in bucket (must be public).  the key value
//  should be some small document file that you save in websiteFiles.
//  c) use zombie to call endpoint/docs/
//  d) should get the document file
//
//
// 7) key is not public
// 8) no such key error from metadata
// 9) redirect all requests with no protocol specified (should use
// same as request)
// 10) redirect all requests with protocol specified
// 11) return user's errordocument
// 12) return our error page for when user's error document can't be retrieved
// 13) redirect with just error code condition
// 14) redirect with just prefix condition
// 15) redirect with error code and prefix condition
// 16) redirect with multiple condition rules and show that first one wins
// 17) redirect with protocol specified
// 18) redirect with hostname specified
// 19) reirect with replaceKeyWith specified
// 20) redirect with replaceKeyPrefixWith specified
// 21) redirect with httpRedirect Code specified
// 22) redirect with combination of redirect items applicable