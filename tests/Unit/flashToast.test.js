import { test } from 'node:test';
import assert from 'node:assert/strict';
import { flashToast } from '../../resources/js/lib/flashToast.js';

test('a success is a green card whose title is the message itself', () => {
    assert.deepEqual(flashToast('تم تسجيل الدفعة بنجاح.'), {
        content: { tone: 'success', icon: 'check', title: 'تم تسجيل الدفعة بنجاح.', description: null },
        timeout: 4000,
    });
});

test('a failure is a red card titled by what failed, the reason under it, and stays longest', () => {
    const saved = flashToast('الرقم المرجعي مكرر.', 'error');
    const deleted = flashToast('الطبلون مستخدم.', 'deleteError');

    assert.deepEqual(saved.content, { tone: 'danger', icon: 'alert', title: 'تعذّر الحفظ', description: 'الرقم المرجعي مكرر.' });
    assert.equal(deleted.content.title, 'تعذّر الحذف');
    assert.equal(saved.timeout, 7000);
    assert.ok(flashToast('تنبيه', 'warning').timeout > flashToast('تم').timeout);
});

test('an empty or missing message shows nothing', () => {
    assert.equal(flashToast(''), null);
    assert.equal(flashToast('   ', 'error'), null);
    assert.equal(flashToast(undefined), null);
});
