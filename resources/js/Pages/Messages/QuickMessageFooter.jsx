import { Link } from '@inertiajs/react';
import Icon from '@/Components/Icon';
import { FOCUS_RING } from './MessageFormParts';
import { PrimaryKey, SecondaryKey } from '@/Components/UI';

/** The quick message's footer: who it reaches, why sending is held back, and cancel and send. */
export default function QuickMessageFooter({ canSend, fullPageUrl, id, onClose, pickedIds, reachedIds, sendBlocker, sending, setConfirming, setup }) {
    return (
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-gray-100 bg-gray-50 px-7 py-4">
            {setup !== null && pickedIds.length <= 400 && (
                <Link
                    href={fullPageUrl}
                    className={`me-auto inline-flex items-center gap-1 rounded text-sm font-semibold text-gray-600 hover:text-gray-900 ${FOCUS_RING}`}
                >
                    <Icon name="external" className="h-4 w-4" />
                    الصفحة الكاملة
                </Link>
            )}
            {setup !== null && sendBlocker && (
                <p id={`${id}-send-blocker`} className="flex items-center gap-1.5 text-sm text-gray-500">
                    <Icon name="info" className="h-4 w-4 shrink-0" />
                    {sendBlocker}
                </p>
            )}
            <SecondaryKey onClick={onClose}>إلغاء</SecondaryKey>
            <PrimaryKey
                type="button"
                onClick={() => setConfirming(true)}
                disabled={!canSend}
                aria-busy={sending}
                aria-describedby={sendBlocker ? `${id}-send-blocker` : undefined}
            >
                <Icon name="send" className="h-4 w-4" />
                {sending ? 'جارٍ الإرسال...' : `إرسال إلى ${reachedIds.length.toLocaleString('en')} مشترك`}
            </PrimaryKey>
        </div>
    );
}
