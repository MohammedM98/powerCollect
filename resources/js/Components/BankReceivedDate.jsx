import { useId } from 'react';
import { usePage } from '@inertiajs/react';
import DateInput from '@/Components/DateInput';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import Switch from '@/Components/Switch';
import { formatDate, localDay } from '@/lib/format';

/**
 * The day a transfer reached the bank, optional. The «اليوم» switch inside
 * the field fills in today in one step and clears it again; picking another
 * day from the calendar turns it off.
 */
export function BankReceivedDateField({ value, onChange, error }) {
    const id = useId();
    const today = usePage().props.paymentOptions?.today ?? localDay();

    return <div>
        <div className="mb-2 flex items-center gap-1">
            <InputLabel htmlFor={id} value="تاريخ وصول الحوالة (اختياري)" />
        </div>
        <DateInput
            id={id}
            name="bank_received_on"
            value={value ?? ''}
            max={today}
            onChange={onChange}
            endContent={<Switch checked={value === today} onChange={(isToday) => onChange(isToday ? today : '')} label="اليوم" ariaLabel="وصلت الحوالة اليوم" />}
        />
        <p className="mt-2 text-xs leading-6 text-gray-500 dark:text-gray-400">اتركه فارغًا إن لم تتأكد منه.</p>
        <InputError message={error} className="mt-2" />
    </div>;
}

export default function BankReceivedDate({ value }) {
    if (!value) return null;

    return <span className="mt-1 block whitespace-normal text-xs leading-6 text-gray-600 dark:text-gray-400">وصول البنك: <bdi dir="ltr" className="font-display">{formatDate(value)}</bdi></span>;
}
