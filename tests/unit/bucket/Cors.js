import assert from 'assert';
import { CORSRule } from '../../../lib/metadata/Cors';

const testParams = {
    id: 'test',
    allowedMethods: [],
    allowedOrigins: [],
    allowedHeaders: [],
    maxAgeSeconds: 60,
    exposedHeaders: [],
};

describe.only('CORSRule class', () => {
    it('should initialize fine without any parameters', done => {
        const rule = new CORSRule();
        assert.strictEqual(rule._id, undefined);
        assert.strictEqual(rule._allowedMethods, undefined);
        assert.strictEqual(rule._allowedOrigins, undefined);
        assert.strictEqual(rule._allowedHeaders, undefined);
        assert.strictEqual(rule._maxAgeSeconds, undefined);
        assert.strictEqual(rule._exposedHeaders, undefined);
        done();
    });

    it('should initialize fine with parameters', done => {
        const rule = new CORSRule(testParams);
        assert.strictEqual(rule._id, testParams.id);
        assert.strictEqual(rule._allowedMethods, testParams.allowedMethods);
        assert.strictEqual(rule._allowedOrigins, testParams.allowedOrigins);
        assert.strictEqual(rule._allowedHeaders, testParams.allowedHeaders);
        assert.strictEqual(rule._maxAgeSeconds, testParams.maxAgeSeconds);
        assert.strictEqual(rule._exposedHeaders, testParams.exposedHeaders);
        done();
    });

    it('getCORSRuleObj should return plain object representation', done => {
        const rule = new CORSRule(testParams);
        assert.deepStrictEqual(rule.getCORSRuleObj(), testParams);
        done();
    });

    describe('setters & getters should work successfully', () => {
        it('for ID', done => {
            const rule = new CORSRule();
            rule.setID(testParams.id);
            assert.strictEqual(rule.getID(), testParams.id);
            done();
        });

        it('for allowedMethods', done => {
            const rule = new CORSRule();
            rule.addAllowedMethod('GET');
            assert.deepStrictEqual(rule.getAllowedMethods(), ['GET']);
            done();
        });

        it('for allowedOrigins', done => {
            const rule = new CORSRule();
            rule.addAllowedOrigin('http://example.com');
            assert.deepStrictEqual(rule.getAllowedOrigins(),
                ['http://example.com']);
            done();
        });

        it('for allowedHeaders', done => {
            const rule = new CORSRule();
            rule.addAllowedHeader('amz-test');
            assert.deepStrictEqual(rule.getAllowedHeaders(), ['amz-test']);
            done();
        });

        it('for maxAgeSeconds', done => {
            const rule = new CORSRule();
            rule.setMaxAgeSeconds(testParams.maxAgeSeconds);
            assert.strictEqual(rule.getMaxAgeSeconds(),
                testParams.maxAgeSeconds);
            done();
        });

        it('for exposeHeaders', done => {
            const rule = new CORSRule();
            rule.addExposeHeader('amz-test');
            assert.deepStrictEqual(rule.getExposeHeaders(), ['amz-test']);
            done();
        });
    });
});
