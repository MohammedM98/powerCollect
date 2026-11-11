import { test } from 'node:test';
import assert from 'node:assert/strict';
import { httpErrorMessage } from '../../resources/js/lib/httpError.js';

test('a request that never reached the server asks to check the connection', () => {
    assert.match(httpErrorMessage({ name: 'HttpNetworkError' }), /تعذّر الاتصال بالخادم/);
});

test('the server first validation message wins over its message and the fallback', () => {
    const error = { name: 'HttpResponseError', response: { data: JSON.stringify({ message: 'عام', errors: { amount: ['المبلغ غير صالح.'] } }) } };

    assert.equal(httpErrorMessage(error, 'احتياطي'), 'المبلغ غير صالح.');
});

test('the server message is used when there are no field errors, then the fallback', () => {
    assert.equal(httpErrorMessage({ response: { data: { message: 'غير مسموح.' } } }, 'احتياطي'), 'غير مسموح.');
    assert.equal(httpErrorMessage({ response: { data: '<html>500</html>' } }, 'احتياطي'), 'احتياطي');
    assert.equal(httpErrorMessage(undefined, 'احتياطي'), 'احتياطي');
});
