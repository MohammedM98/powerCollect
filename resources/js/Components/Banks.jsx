import { usePage } from '@inertiajs/react';
import { Label, ListBox, Radio, RadioGroup, Select } from '@heroui/react';
import Icon from '@/Components/Icon';

/**
 * Each transfer bank or e-wallet's logo, color and kind; one not listed here gets a plain tile.
 * Every logo is a square image with its own padding, so all marks share one size and fit.
 */
const BANKS = {
    'بنك فلسطين': { logo: '/images/banks/bank-of-palestine.webp', color: '#b8007a', kind: 'تحويل بنكي' },
    'جوال باي': { logo: '/images/banks/jawwal-pay.webp', color: '#7cb342', kind: 'محفظة' },
    'محفظة بالباي': { logo: '/images/banks/palpay.webp', color: '#9b30e0', kind: 'محفظة' },
    'البنك الإسلامي الفلسطيني': { logo: '/images/banks/palestine-islamic-bank.webp', color: '#173d69', kind: 'تحويل بنكي' },
    'البنك الإسلامي العربي': { logo: '/images/banks/arab-islamic-bank.webp', color: '#7b2d8e', kind: 'تحويل بنكي' },
    'بنك القدس': { logo: '/images/banks/quds-bank.webp', color: '#74bd44', kind: 'تحويل بنكي' },
};

/** The «غير محدد» choice's key: HeroUI's keys are never empty. */
const EMPTY_BANK = '__none__';

function useBankLook(bank) {
    const managed = usePage().props.paymentOptions?.banks?.find((option) => option.name === bank);
    return managed?.logo ? { ...BANKS[bank], logo: managed.logo } : BANKS[bank];
}

export function BankMark({ bank, className = 'h-10 w-10 rounded-xl' }) {
    const look = useBankLook(bank);

    if (!look) {
        return (
            <span className={`flex shrink-0 items-center justify-center bg-gray-100 text-gray-600 ${className}`}>
                <Icon name="bank" className="h-1/2 w-1/2" />
            </span>
        );
    }

    return (
        <span className={`shrink-0 overflow-hidden border border-gray-100 bg-white shadow-[0_4px_10px_-6px_rgb(0_0_0/0.4)] ${className}`}>
            <img src={look.logo} alt="" className="h-full w-full object-contain" />
        </span>
    );
}

/**
 * The company's banks and e-wallets as chips on HeroUI's radio group, as
 * in the redesign: each with its mark and name, the chosen one ringed in
 * the company's colour. `name` is the field's name in the form.
 */
export function BankChips({ banks, name, label, value, onChange, isRequired = false }) {
    return (
        <RadioGroup name={name} aria-label={label} isRequired={isRequired} value={value || null} onChange={onChange} className="gl-bank-chips">
            {banks.map((bank) => (
                <Radio key={bank} value={bank} className="gl-bank-chip">
                    <Radio.Content className="gl-bank-chip-content">
                        <BankMark bank={bank} className="h-7 w-7 rounded-lg" />
                        <span>{bank}</span>
                        <Radio.Control className="sr-only"><Radio.Indicator /></Radio.Control>
                    </Radio.Content>
                </Radio>
            ))}
        </RadioGroup>
    );
}

/**
 * The sending bank or e-wallet as a drop-down: HeroUI's Select on the
 * frosted pop surface, each choice with its mark and kind, and «غير محدد»
 * first. `id` goes on its key, so a page's <label htmlFor> names it;
 * `name` keeps the choice in the form.
 */
export function BankDropdown({ banks, id, name, onChange, value }) {
    const selectedLook = useBankLook(value);

    return (
        <Select
            name={name}
            aria-label="البنك المرسل"
            className="gl-bank-select w-full"
            selectedKey={value ? value : EMPTY_BANK}
            onSelectionChange={(key) => onChange(key === EMPTY_BANK ? '' : String(key))}
        >
            <Label className="sr-only">البنك المرسل</Label>
            <Select.Trigger id={id} className="flex min-h-[58px] w-full items-center gap-3 rounded-[14px] border-[1.5px] border-gray-200 bg-surface px-3 py-2 text-start transition hover:border-brand-500/45 data-[open=true]:border-brand-500 data-[open=true]:ring-4 data-[open=true]:ring-brand-500/15">
                {value ? (
                    <>
                        <BankMark bank={value} />
                        <span className="min-w-0">
                            <b className="block truncate text-[14.5px] text-gray-900">{value}</b>
                            <small className="block text-xs font-medium text-gray-500">{selectedLook?.kind ?? 'تحويل'}</small>
                        </span>
                    </>
                ) : (
                    <span className="text-sm text-gray-400">اختر البنك أو المحفظة المحوّل منها</span>
                )}
                <Select.Indicator className="ms-auto shrink-0 text-gray-400" />
            </Select.Trigger>
            <Select.Popover className="gl-choice-pop">
                <ListBox className="max-h-80 overflow-y-auto">
                    <ListBox.Item id={EMPTY_BANK} textValue="غير محدد" className="flex items-center gap-3 rounded-xl px-3 py-2.5">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 text-gray-400">
                            <Icon name="close" className="h-4 w-4" />
                        </span>
                        <span className="text-sm">غير محدد</span>
                        <ListBox.ItemIndicator />
                    </ListBox.Item>
                    {banks.map((bank) => (
                        <ListBox.Item key={bank} id={bank} textValue={bank} className="flex items-center gap-3 rounded-xl px-3 py-2.5">
                            <BankMark bank={bank} />
                            <span className="min-w-0">
                                <b className="block text-[14.5px] text-gray-900">{bank}</b>
                                <small className="block text-xs font-medium text-gray-500">{BANKS[bank]?.kind ?? 'تحويل'}</small>
                            </span>
                            <ListBox.ItemIndicator />
                        </ListBox.Item>
                    ))}
                </ListBox>
            </Select.Popover>
        </Select>
    );
}
