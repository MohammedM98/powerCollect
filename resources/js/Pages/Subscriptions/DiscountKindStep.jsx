import Icon from '@/Components/Icon';
import { ChoiceTile, FormStep } from './AccountFormParts';
import { withSegment } from '@/lib/discountTerms';

/** A discount comes off the balance once, in shekels, or off every weekly reading from now on. */
const KINDS = [
    { value: 'once', icon: 'tag', title: 'لمرة واحدة', hint: 'مبلغ بالشيكل يُخصم الآن من الرصيد المستحق' },
    { value: 'standing', icon: 'repeat', title: 'خصم القراءات الأسبوعية', hint: 'من كل قراءة أسبوعية حتى تُوقفه' },
];

/** Whether the discount is taken once from the balance, or from every weekly reading. */
export default function DiscountKindStep({ changeKind, data, isStanding, setConfirmingStop, standingDiscount, steps, stopping }) {
    return (
        <FormStep number={steps.kind} title="نوع الخصم" done>
            <fieldset>
                <legend className="sr-only">نوع الخصم</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                    {KINDS.map((kind) => (
                        <ChoiceTile
                            key={kind.value}
                            name="kind"
                            value={kind.value}
                            checked={data.kind === kind.value}
                            onChange={changeKind}
                            icon={kind.icon}
                            title={kind.title}
                            hint={kind.hint}
                            tone="green"
                        />
                    ))}
                </div>
            </fieldset>
            {isStanding && standingDiscount && (
                <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-emerald-600/45 bg-emerald-500/10 px-3.5 py-3 text-sm">
                    <Icon name="repeat" className="h-[18px] w-[18px] shrink-0 text-emerald-700 dark:text-emerald-400" />
                    <div className="min-w-0 flex-1">
                        <b className="font-bold text-gray-900">
                            لديه خصم على القراءات الأسبوعية: {withSegment(standingDiscount.terms, standingDiscount.segment)}
                        </b>
                        <small className="block text-[12.5px] text-gray-500">
                            منذ <bdi dir="ltr">{standingDiscount.grantedAt}</bdi>
                            {standingDiscount.grantedByName && ` · أعطاه ${standingDiscount.grantedByName}`}. الخصم الجديد يحلّ محلّه.
                        </small>
                    </div>
                    <button
                        type="button"
                        onClick={() => setConfirmingStop(true)}
                        disabled={stopping}
                        className="h-9 shrink-0 rounded-xl border border-gray-200 bg-surface px-3 text-[13.5px] font-bold text-brand-600 transition hover:bg-gray-50 disabled:opacity-50"
                    >
                        {stopping ? 'جارٍ الإيقاف...' : 'إيقاف'}
                    </button>
                </div>
            )}
        </FormStep>
    );
}
