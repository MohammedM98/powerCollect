import { Button } from '@heroui/react';
import Balance from '@/Components/Balance';
import Icon from '@/Components/Icon';
import { formatMoney } from '@/lib/format';

/** How many of the account's last lines show above the new one. */
const SHOWN_LINES = 3;

/** The account's last lines that still count: neither cancelled nor the reversal of one, oldest first. */
export function recentStatementLines(entries = []) {
    return entries
        .filter((entry) => !entry.cancellation && !entry.isReversal)
        .sort((a, b) => (a.lineNumber ?? 0) - (b.lineNumber ?? 0))
        .slice(-SHOWN_LINES);
}

/** A line's day as the statement writes it, e.g. 19/11. */
function shortDay(date) {
    const match = /^\d{4}-(\d{2})-(\d{2})/.exec(String(date ?? ''));

    return match ? `${match[2]}/${match[1]}` : '';
}

/**
 * A movement written as the statement's next line, as in the redesign (the
 * charge, clearing and discount windows): the account's last lines (`lines`,
 * oldest first), then the new line with its description and amount typed in
 * place (`description` and `amount`, the form's own fields) and the balance
 * it leaves. `side` puts the amount under عليه (a charge, the default) or له
 * (a clearing, a discount); `tone` gives the line its movement's colour. With
 * no lines to show (the payments page), the balance now stands in for them.
 */
export default function LedgerLine({ lines, balance, balanceAfter, shortcuts = null, description, amount, side = 'debit', tone = 'charge' }) {
    const credit = side === 'credit';

    return (
        <section className="gl-cl" data-tone={tone} aria-label="كشف الحساب والسطر الجديد" data-excel-source="custom">
            <div className="gl-cl-cap">
                <span>
                    <b>كشف الحساب</b>، آخر الحركات ثم سطرك الجديد
                </span>
                {shortcuts && <span className="kbd">{shortcuts} للنوع</span>}
            </div>
            <div className="gl-cl-scroll">
                <table className="gl-cl-table">
                    <thead>
                        <tr>
                            <th scope="col">التاريخ</th>
                            <th scope="col">البيان</th>
                            <th scope="col">عليه</th>
                            <th scope="col">له</th>
                            <th scope="col">الرصيد</th>
                        </tr>
                    </thead>
                    <tbody>
                        {lines.length > 0 ? (
                            lines.map((line) => (
                                <tr key={line.id} className="is-old">
                                    <td className="gl-num">{shortDay(line.date)}</td>
                                    <td>
                                        <span className="gl-cl-desc">{line.description}</span>
                                        {line.details && <small>{line.details}</small>}
                                    </td>
                                    <td className="gl-num is-owe">{line.isCredit ? '' : formatMoney(line.amount)}</td>
                                    <td className="gl-num is-pay">{line.isCredit ? formatMoney(line.amount) : ''}</td>
                                    <td className="gl-num"><Balance value={line.balance} colored={false} unit="" paperWord={false} /></td>
                                </tr>
                            ))
                        ) : (
                            <tr className="is-old">
                                <td>—</td>
                                <td><span className="gl-cl-desc">الرصيد الحالي</span></td>
                                <td />
                                <td />
                                <td className="gl-num"><Balance value={balance} colored={false} unit="" paperWord={false} /></td>
                            </tr>
                        )}
                        <tr className="is-new">
                            <td><span className="gl-cl-today">اليوم</span></td>
                            <td>{description}</td>
                            <td>{credit ? null : amount}</td>
                            <td>{credit ? amount : null}</td>
                            <td>
                                <b className="gl-cl-after gl-num" aria-live="polite">
                                    <Balance value={balanceAfter ?? balance} unit="₪" paperWord={false} />
                                </b>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </section>
    );
}

/** The window's footer: the keys, the balance the line leaves, cancel and the button in the line's colour. */
export function LedgerFooter({ balance, balanceAfter, onCancel, disabled, label, keys = null, summary = null }) {
    return (
        <div className="gl-dialog-foot gl-sheet-foot gl-cl-foot">
            <span className="gl-sheet-keys">
                <span className="kbd" dir="ltr">Esc</span> إغلاق
                {keys}
                <span className="kbd" dir="ltr">Ctrl ↵</span> حفظ
            </span>
            <div className="gl-cl-total">
                <small>{summary?.label ?? 'الرصيد بعده'}</small>
                <b className="gl-num">{summary ? summary.value : <Balance value={balanceAfter ?? balance} colored={false} unit="₪" paperWord={false} />}</b>
            </div>
            <Button onPress={onCancel} className="gl-sheet-btn">
                إلغاء
            </Button>
            <Button type="submit" isDisabled={disabled} className="gl-sheet-btn is-submit">
                <Icon name="check" className="h-[18px] w-[18px]" strokeWidth={2.2} />
                {label}
            </Button>
        </div>
    );
}
