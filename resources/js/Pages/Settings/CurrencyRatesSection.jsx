import { useForm } from '@inertiajs/react';
import { Chip, FieldError, InputGroup, Label, TextField } from '@heroui/react';
import Icon from '@/Components/UI/Icon';
import { formatMoney } from '@/lib/format';
import { SaveButton, SettingsSection } from '@/Components/Settings/SettingsKit';

/** One currency's rate: its code on a tile, the rate in shekels, what ten of it come to, and its own save key. */
function CurrencyEditor({ currency }) {
    const form = useForm({ rate: currency.rate ?? '' });
    const rate = Number(form.data.rate);
    const isPayable = rate > 0;

    function save(event) {
        event.preventDefault();
        form.put(currency.updateUrl, { preserveScroll: true, onSuccess: () => form.setDefaults() });
    }

    return (
        <form onSubmit={save} aria-labelledby={`currency-${currency.code}`} className="gl-set-tile gl-set-currency">
            <div className="gl-set-currency-head">
                <bdi className="gl-set-code">{currency.code}</bdi>
                <h3 id={`currency-${currency.code}`} className="gl-set-currency-name">{currency.label}</h3>
                <Chip size="sm" variant="soft" color={isPayable ? 'success' : 'warning'} className="gl-set-chip ms-auto">
                    {isPayable ? 'مفعّلة للدفع' : 'غير مفعّلة للدفع'}
                </Chip>
            </div>
            <TextField isRequired isInvalid={Boolean(form.errors.rate)} className="gl-set-field" value={String(form.data.rate)} onChange={(value) => form.setData('rate', value)}>
                <Label>سعر الصرف بالشيكل</Label>
                <InputGroup>
                    <InputGroup.Input id={`rate-${currency.code}`} name="rate" type="number" min="0.0001" max="10000" step="0.0001" dir="ltr" className="gl-num" />
                    <InputGroup.Suffix>₪</InputGroup.Suffix>
                </InputGroup>
                <FieldError>{form.errors.rate}</FieldError>
            </TextField>
            <div className="gl-set-currency-foot">
                <p className="gl-set-hint">
                    {isPayable ? <>10 {currency.label} = <bdi className="gl-num font-bold text-[var(--ma-ink)]">{formatMoney(rate * 10)}</bdi> شيكل</> : 'أدخل سعرًا لتظهر هذه العملة عند تسجيل الدفعات.'}
                </p>
                <SaveButton processing={form.processing} isDisabled={!form.isDirty}>حفظ السعر</SaveButton>
            </div>
        </form>
    );
}

export default function CurrencyRatesSection({ currencies }) {
    const baseCurrency = currencies.find((currency) => currency.code === 'ILS');

    return (
        <SettingsSection
            id="currency-rates"
            icon="currency"
            tone="pay"
            title="العملات وأسعار الصرف"
            description="تُطبّق الأسعار تلقائيًا على الدفعات الجديدة. تبقى الدفعات السابقة بسعر الصرف المسجّل وقت الدفع."
        >
            {baseCurrency && (
                <div className="gl-set-base">
                    <bdi className="gl-set-code">{baseCurrency.code}</bdi>
                    <div className="min-w-0 flex-1">
                        <b>{baseCurrency.label}</b>
                        <small>عملة الحساب الأساسية</small>
                    </div>
                    <span className="gl-set-lock">
                        <Icon name="lock" className="h-4 w-4" />
                        السعر ثابت: <bdi className="gl-num">1</bdi> شيكل
                    </span>
                </div>
            )}
            <div className="gl-set-grid">
                {currencies.filter((currency) => currency.code !== 'ILS').map((currency) => (
                    <CurrencyEditor key={`${currency.id}-${currency.rate}`} currency={currency} />
                ))}
            </div>
        </SettingsSection>
    );
}
