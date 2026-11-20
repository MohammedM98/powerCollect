import { Button, Input } from '@heroui/react';
import Icon from '@/Components/Icon';
import Switch from '@/Components/Switch';
import SecondaryButton from '@/Components/SecondaryButton';
import { withStaleCleared } from '@/lib/filterGroups';
import { Card, Field, FOCUS_RING } from './MessageFormParts';

/** Who the message is for: the kind, the branch, box, breaker, status and the kind's own criteria, and loading the list. */
export default function MessageRecipientCriteria({
    branchOptions,
    branchWeekOptions,
    circuitBreakerOptions,
    criteria,
    kind,
    loadRecipients,
    loading,
    meterBoxGroups,
    meterBoxNames,
    meterBoxNumbers,
    recipients,
    setCriteria,
    setCriterion,
    statusOptions,
}) {
    return (
        <Card icon="filter" title="المستلمون" description="من تصله الرسالة من مشتركي فرعك.">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {kind === 'weekly_reading' && (
                    <>
                        <Field label="أسبوع القراءة" htmlFor="week_start">
                            <select
                                id="week_start"
                                value={criteria.week_start}
                                onChange={(e) => setCriterion('week_start', e.target.value)}
                                className="block w-full text-sm"
                            >
                                {!branchWeekOptions.some((option) => option.value === criteria.week_start) && (
                                    <option value={criteria.week_start}>الأسبوع ابتداءً من {criteria.week_start}</option>
                                )}
                                {branchWeekOptions.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </Field>
                        <div className="flex items-end pb-2">
                            <Switch
                                checked={criteria.approved_only}
                                onChange={(value) => setCriterion('approved_only', value)}
                                label="القراءات المعتمدة فقط"
                            />
                        </div>
                    </>
                )}

                {kind === 'balance_reminder' && (
                    <Field label="من عليه رصيد أكبر من (₪)" htmlFor="min_balance">
                        <Input
                            id="min_balance"
                            type="number"
                            min="0"
                            step="0.01"
                            inputMode="decimal"
                            value={criteria.min_balance}
                            onChange={(e) => setCriterion('min_balance', e.target.value)}
                            placeholder="0"
                            className="block w-full text-sm"
                        />
                    </Field>
                )}

                <Field label="حالة المشترك" htmlFor="status">
                    <select
                        id="status"
                        value={criteria.status}
                        onChange={(e) => setCriterion('status', e.target.value)}
                        className="block w-full text-sm"
                    >
                        <option value="">كل الحالات</option>
                        {statusOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </Field>

                {branchOptions.length > 0 && (
                    <Field label="الفرع" htmlFor="branch_id">
                        <select
                            id="branch_id"
                            value={criteria.branch_id}
                            onChange={(e) =>
                                setCriteria((current) => ({
                                    ...current,
                                    ...withStaleCleared(meterBoxGroups, current, { branch_id: e.target.value }),
                                }))
                            }
                            className="block w-full text-sm"
                        >
                            <option value="">كل الفروع</option>
                            {branchOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </Field>
                )}

                <Field label="الطبلون" htmlFor="meter_box_name">
                    <select
                        id="meter_box_name"
                        value={criteria.meter_box_name}
                        onChange={(e) => setCriteria((current) => ({ ...current, meter_box_name: e.target.value, meter_box_id: '' }))}
                        className="block w-full text-sm"
                    >
                        <option value="">كل الطبلونات</option>
                        {meterBoxNames.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </Field>

                {criteria.meter_box_name !== '' && (
                    <Field label="رقم الطبلون" htmlFor="meter_box_id">
                        <select
                            id="meter_box_id"
                            value={criteria.meter_box_id}
                            onChange={(e) => setCriterion('meter_box_id', e.target.value)}
                            className="block w-full text-sm"
                        >
                            <option value="">كل الأرقام</option>
                            {meterBoxNumbers.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </Field>
                )}

                <Field label="القاطع" htmlFor="circuit_breaker_id">
                    <select
                        id="circuit_breaker_id"
                        value={criteria.circuit_breaker_id}
                        onChange={(e) => setCriterion('circuit_breaker_id', e.target.value)}
                        className="block w-full text-sm"
                    >
                        <option value="">كل القواطع</option>
                        {circuitBreakerOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </Field>

                <Field label="بحث" htmlFor="search">
                    <Input
                        id="search"
                        type="text"
                        value={criteria.search}
                        onChange={(e) => setCriterion('search', e.target.value)}
                        placeholder="الاسم أو الهاتف أو رقم الاشتراك"
                        className="block w-full text-sm"
                    />
                </Field>
            </div>

            {criteria.subscription_ids.length > 0 && (
                <div className="mt-4 flex items-center justify-between gap-3 rounded-control bg-gray-50 px-3 py-2 text-sm text-gray-600">
                    <span>الرسالة لمشترك محدد من قائمة المشتركين.</span>
                    <Button data-raw="" variant="ghost"
                        onClick={() => setCriterion('subscription_ids', [])}
                        className={`rounded font-semibold text-brand-600 hover:underline ${FOCUS_RING}`}
                    >
                        إلغاء التحديد
                    </Button>
                </div>
            )}

            <div className="mt-5">
                <SecondaryButton onClick={loadRecipients} disabled={loading} aria-busy={loading}>
                    <Icon name="users" className="h-4 w-4" />
                    {loading ? 'جارٍ التحميل...' : recipients === null ? 'عرض المستلمين' : 'تحديث المستلمين'}
                </SecondaryButton>
            </div>
        </Card>
    );
}
