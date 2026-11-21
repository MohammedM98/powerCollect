import Icon from '@/Components/Icon';
import ChoiceChips from '@/Components/ChoiceChips';
import { CHANNEL_ICONS, withIcons } from './MessageParts';
import { Section } from './MessageFormParts';

/** How the quick message goes out: SMS when the company sends them, or WhatsApp one by one. */
export default function QuickMessageChannel({ channel, setChannel, setup }) {
    return (
        <Section title="طريقة الإرسال">
            <ChoiceChips options={withIcons(setup.channels, CHANNEL_ICONS)} value={channel} onChange={setChannel} label="طريقة الإرسال" />
            {channel === 'sms' && !setup.smsDeliversMessages && (
                <p
                    role="note"
                    className="flex items-start gap-2 rounded-control bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-300"
                >
                    <Icon name="warning" className="mt-1 h-4 w-4 shrink-0" />
                    لم تُضبط بوابة الرسائل النصية بعد، فتُسجَّل الرسائل في سجل النظام فقط ولا تصل للمشتركين. أرسل عبر واتساب أو اطلب ضبط مزوّد SMS.
                </p>
            )}
            {channel === 'whatsapp' && (
                <p className="text-sm text-gray-500">تُجهَّز الرسائل وتنتقل إلى صفحة الإرسال: زر لكل مشترك يفتح واتساب والرسالة مكتوبة.</p>
            )}
        </Section>
    );
}
