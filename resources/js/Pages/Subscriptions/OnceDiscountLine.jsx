import { Button, Input } from '@heroui/react';
import InputError from '@/Components/InputError';
import { formatMoney, normalizeDecimalInput } from '@/lib/format';
import LedgerLine from './LedgerLine';

const QUICK_VALUES = [10, 20, 50];

/**
 * A one-off discount written as the statement's next line: its note as the
 * line's description and its shekels under له, with the usual amounts and
 * "all that is owed" under the statement.
 */
export default function OnceDiscountLine({ balance, balanceAfter, data, errors, invalid, lines, owed, setData, setValue, tone, valueInput }) {
    return (
        <div>
            <LedgerLine
                tone={tone}
                side="credit"
                lines={lines}
                balance={balance}
                balanceAfter={balanceAfter}
                description={
                    <div className="gl-cl-in" data-invalid={errors.notes ? true : undefined}>
                        <label htmlFor="discount_notes" className="sr-only">ملاحظات</label>
                        <Input
                            id="discount_notes"
                            name="notes"
                            maxLength={1000}
                            autoComplete="off"
                            placeholder="خصم، مثال: بموافقة المدير (اختياري)"
                            value={data.notes}
                            onChange={(e) => setData('notes', e.target.value)}
                        />
                    </div>
                }
                amount={
                    <div className="gl-cl-in is-amount" data-invalid={errors.value || invalid ? true : undefined}>
                        <Input
                            ref={valueInput}
                            id="value"
                            name="value"
                            required
                            autoFocus
                            inputMode="decimal"
                            autoComplete="off"
                            dir="ltr"
                            placeholder="0.00"
                            aria-label="قيمة الخصم"
                            value={data.value}
                            onChange={(e) => setData('value', normalizeDecimalInput(e.target.value))}
                        />
                        <span aria-hidden="true">₪</span>
                    </div>
                }
            />

            <div className="gl-cl-under">
                <div className="gl-cl-quick">
                    {QUICK_VALUES.map((quick) => (
                        <Button key={quick} className="gl-num" aria-label={`${quick} شيكل`} onClick={() => setValue(quick)}>
                            {quick}
                        </Button>
                    ))}
                    {owed > 0 && (
                        <Button className="is-settle" onClick={() => setValue(owed)}>
                            كل ما عليه <bdi className="gl-num">{formatMoney(owed)}</bdi>
                        </Button>
                    )}
                </div>
                <span className="gl-cl-hint ms-auto">يُنزَّل مرة واحدة من الرصيد المستحق، ولا يزيد عليه.</span>
            </div>
            <InputError message={errors.value ?? invalid} className="mt-2" />
            <InputError message={errors.notes} className="mt-2" />
        </div>
    );
}
