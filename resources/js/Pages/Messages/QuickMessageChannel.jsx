import ChoiceChips from '@/Components/UI/ChoiceChips';
import { CHANNEL_ICONS, withIcons } from './MessageParts';
import { Section } from './MessageFormParts';
import { Notice } from '@/Components/UI';

/** How the quick message goes out: SMS when the company sends them, or WhatsApp one by one. */
export default function QuickMessageChannel({ channel, setChannel, setup }) {
    return (
        <Section title="طريقة الإرسال">
            <ChoiceChips options={withIcons(setup.channels, CHANNEL_ICONS)} value={channel} onChange={setChannel} label="طريقة الإرسال" />
            {channel === 'sms' && !setup.smsDeliversMessages && (
                <Notice tone="warn" role="note">
                    لم تُضبط بوابة الرسائل النصية بعد، فتُسجَّل الرسائل في سجل النظام فقط ولا تصل للمشتركين. أرسل عبر واتساب أو اطلب ضبط مزوّد SMS.
                </Notice>
            )}
            {channel === 'whatsapp' && (
                <p className="text-sm text-(--ma-muted)">تُجهَّز الرسائل وتنتقل إلى صفحة الإرسال: زر لكل مشترك يفتح واتساب والرسالة مكتوبة.</p>
            )}
        </Section>
    );
}
