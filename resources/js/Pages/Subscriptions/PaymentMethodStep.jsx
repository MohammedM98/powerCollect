import { Input } from '@heroui/react';
import InputError from '@/Components/InputError';
import { FieldLabel, FormStep } from './AccountFormParts';
import { inputClass, MethodTile, TransferFields } from './PaymentModalParts';

/** How the payment came: cash, or a bank transfer with its bank, reference, sender and arrival date, and the reference check. */
export default function PaymentMethodStep({
    data,
    errors,
    methods,
    referenceCheck,
    referenceStatus,
    senderBanks,
    senderIsSubscriber,
    setData,
    throughBank,
    toggleSender,
    transferBanks,
}) {
    return (
        <FormStep
            number={2}
            title="طريقة الدفع"
            hint={methods.length > 1 ? 'بالأرقام 1، 2' : null}
            done={throughBank ? Boolean(data.bank_name) : Boolean(data.payment_method)}
        >
            <fieldset>
                <legend className="sr-only">طريقة الدفع</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                    {methods.map((method) =>
                        method === 'bank_transfer' ? (
                            <MethodTile
                                key={method}
                                value={method}
                                checked={throughBank}
                                onChange={(value) => setData('payment_method', value)}
                                icon="bank"
                                title="تحويل بنكي أو محفظة"
                                hint={transferBanks.join('، ')}
                            />
                        ) : (
                            <MethodTile
                                key={method}
                                value={method}
                                checked={data.payment_method === method}
                                onChange={(value) => setData('payment_method', value)}
                                icon="banknotes"
                                title="نقد"
                                hint="استُلم المبلغ نقدًا"
                            />
                        ),
                    )}
                </div>
                <InputError message={errors.payment_method} className="mt-2" />

                {throughBank && (
                    <TransferFields
                        data={data}
                        setData={setData}
                        errors={errors}
                        transferBanks={transferBanks}
                        senderBanks={senderBanks}
                        senderIsSubscriber={senderIsSubscriber}
                        onSenderToggle={toggleSender}
                        checkingReference={referenceCheck.processing}
                        referenceStatus={referenceStatus}
                    />
                )}

                {!throughBank && (
                    <div className="animate-menu gl-receipt mt-3 grid gap-4 border-solid! p-4">
                        <div>
                            <FieldLabel htmlFor="manual_voucher_number" hint="رقم الوصل الورقي">
                                رقم السند اليدوي
                            </FieldLabel>
                            <Input
                                id="manual_voucher_number"
                                name="manual_voucher_number"
                                dir="ltr"
                                autoComplete="off"
                                placeholder="مثال: 00412"
                                value={data.manual_voucher_number}
                                onChange={(e) => setData('manual_voucher_number', e.target.value)}
                                className={`${inputClass} text-end font-display placeholder:font-sans placeholder:font-normal`}
                            />
                            <InputError message={errors.manual_voucher_number} className="mt-2" />
                        </div>
                    </div>
                )}
            </fieldset>
        </FormStep>
    );
}
