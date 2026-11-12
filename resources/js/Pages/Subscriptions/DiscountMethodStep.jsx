import InputError from '@/Components/InputError';
import { ChoiceTile, FormStep } from './AccountFormParts';
import { fieldFor } from '@/lib/discountTerms';

const METHOD_ICONS = { percentage: 'percent', kilowatt: 'bolt', shekel: 'currency' };

/** How a standing discount is taken from each reading: a percentage, free kilowatts, or shekels off the kilowatt price. */
export default function DiscountMethodStep({ changeMethod, data, errors, kiloPrice, methods, steps }) {
    return (
        <FormStep number={steps.method} title="طريقة الخصم" hint="بالأرقام 1 · 2 · 3" done={Boolean(data.method)}>
            <fieldset>
                <legend className="sr-only">طريقة الخصم</legend>
                <div className="grid gap-3 sm:grid-cols-3">
                    {methods.map((method, index) => {
                        const look = fieldFor(data.kind, method, kiloPrice);

                        return (
                            <ChoiceTile
                                key={method}
                                name="method"
                                value={method}
                                checked={data.method === method}
                                onChange={changeMethod}
                                icon={METHOD_ICONS[method]}
                                title={look.title}
                                hint={look.tileHint}
                                tone="green"
                                stacked
                                shortcut={index + 1}
                            />
                        );
                    })}
                </div>
                <InputError message={errors.method} className="mt-2" />
            </fieldset>
        </FormStep>
    );
}
