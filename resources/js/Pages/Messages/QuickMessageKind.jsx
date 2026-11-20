import { Input } from '@heroui/react';
import ChoiceChips from '@/Components/ChoiceChips';
import InputError from '@/Components/InputError';
import { KIND_HINTS, KIND_ICONS, withIcons } from './MessageParts';
import { Section } from './MessageFormParts';
import { ChoiceSelect, Switch } from '@/Components/UI';

/** What the quick message is about, and the kind's own choices: the reading week and approved-only, or the least balance. */
export default function QuickMessageKind({
    approvedOnly,
    changeKind,
    errors,
    id,
    kind,
    minBalance,
    setApprovedOnly,
    setMinBalance,
    setWeekStart,
    setup,
    weekOptions,
    weekStart,
}) {
    return (
        <Section title="نوع الرسالة" hint={KIND_HINTS[kind]}>
            <ChoiceChips options={withIcons(setup.kinds, KIND_ICONS)} value={kind} onChange={changeKind} label="نوع الرسالة" />
            {kind === 'weekly_reading' && (
                <div className="flex flex-wrap items-end gap-4">
                    <div className="min-w-[220px] flex-1">
                        <label htmlFor={`${id}-week`} className="mb-1.5 block text-sm font-semibold text-gray-700">
                            أسبوع القراءة
                        </label>
                        <ChoiceSelect id={`${id}-week`} value={weekStart} onChange={(e) => setWeekStart(e.target.value)} className="block w-full text-sm">
                            {weekOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </ChoiceSelect>
                        <InputError message={errors.week_start} className="mt-1" />
                    </div>
                    <div className="pb-2">
                        <Switch checked={approvedOnly} onChange={setApprovedOnly} label="القراءات المعتمدة فقط" />
                    </div>
                </div>
            )}
            {kind === 'balance_reminder' && (
                <div className="max-w-xs">
                    <label htmlFor={`${id}-min-balance`} className="mb-1.5 block text-sm font-semibold text-gray-700">
                        لمن عليه رصيد أكبر من (₪)
                    </label>
                    <Input
                        id={`${id}-min-balance`}
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        value={minBalance}
                        onChange={(e) => setMinBalance(e.target.value)}
                        placeholder="0"
                        className="block w-full text-sm"
                    />
                </div>
            )}
        </Section>
    );
}
