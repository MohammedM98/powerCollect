import InputError from '@/Components/InputError';
import { ChoiceCards, FormStep } from './AccountFormParts';
import { fieldFor } from '@/lib/discountTerms';

const METHOD_ICONS = { percentage: 'percent', kilowatt: 'bolt', shekel: 'currency' };

/** How a standing discount is taken from each reading: a percentage, free kilowatts, or shekels off the kilowatt price. */
export default function DiscountMethodStep({ changeMethod, data, errors, kiloPrice, methods, steps }) {
    return (
        <FormStep number={steps.method} title="طريقة الخصم" hint="بالأرقام 1، 2، 3" done={Boolean(data.method)}>
            <div>
                <ChoiceCards
                    name="method"
                    label="طريقة الخصم"
                    isRequired
                    columns={3}
                    value={data.method}
                    onChange={changeMethod}
                    options={methods.map((method) => {
                        const look = fieldFor(data.kind, method, kiloPrice);

                        return { value: method, icon: METHOD_ICONS[method], title: look.title, hint: look.tileHint };
                    })}
                />
                <InputError message={errors.method} className="mt-2" />
            </div>
        </FormStep>
    );
}
