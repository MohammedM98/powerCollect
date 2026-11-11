import { formatAmount } from './currency.ts';
import { formatMoney } from './format.js';
import { discountAmount } from './accountStatement.js';
import { weeklyCharges } from './readings.js';

/** The standing discount's methods, in the order they are offered (and picked with 1 · 2 · 3). */
export const METHOD_ORDER = ['percentage', 'kilowatt', 'shekel'];

/** What the value field asks for: shekels off the balance once, or by method for the weekly readings discount. */
export function fieldFor(kind, method, kiloPrice) {
    if (kind === 'once') {
        return { label: 'المبلغ', hint: 'بالشيكل', unit: '₪', suffix: ' ₪' };
    }

    return {
        percentage: { title: 'نسبة', tileHint: 'من قيمة كل قراءة', label: 'النسبة من كل قراءة', hint: 'من 1 إلى 100', unit: '%', suffix: '%' },
        kilowatt: {
            title: 'كيلوات',
            tileHint: 'كيلوات مجانية كل أسبوع',
            label: 'الكيلوات المجانية كل أسبوع',
            hint: `الكيلو بـ ${formatMoney(kiloPrice)} ₪`,
            unit: 'كيلو',
            suffix: ' كيلو',
        },
        shekel: {
            title: 'شيكل من سعر الكيلو',
            tileHint: 'يُنزل من سعر الكيلو',
            label: 'الخصم من سعر الكيلو',
            hint: `سعر الكيلو ${formatMoney(kiloPrice)} ₪`,
            unit: '₪',
            suffix: ' ₪',
        },
    }[method];
}

/** How a standing discount reads: "10%", "3 كيلو" or "5 شيكل من سعر الكيلو". Mirrors StandingDiscount::termsFor(). */
export function standingTerms(method, value) {
    const amount = formatAmount(value);

    return { percentage: `${amount}%`, kilowatt: `${amount} كيلو`, shekel: `${amount} شيكل من سعر الكيلو` }[method];
}

/** A standing discount's terms with the customer segment it is given to: "3 كيلو · موظفو أبو زايد". */
export function withSegment(terms, segment) {
    return segment ? `${terms} · ${segment}` : terms;
}

/**
 * What the discount form shows for what is typed: the value's field, the
 * methods offered, why the value can't be used, what a one-off discount
 * takes off and leaves, a standing discount's effect on the last week's
 * bill (or on 10 kilos when nothing was read), and the steps' numbers in
 * the order they show.
 */
export function discountPreview(data, subscription, balance, discountMethods, correcting = null) {
    const isStanding = data.kind === 'standing';
    const kiloPrice = Number(subscription.kiloPrice);
    const owed = Math.max(Number(balance), 0);
    const value = Number(data.value) > 0 ? Number(data.value) : 0;
    const field = fieldFor(data.kind, data.method, kiloPrice);
    const methods = isStanding ? METHOD_ORDER.filter((method) => discountMethods.some((option) => option.value === method)) : [];

    // What makes the value unusable, said under it.
    let invalid = null;

    if (data.method === 'percentage' && value > 100) {
        invalid = 'النسبة لا تزيد عن 100%.';
    } else if (isStanding && data.method === 'shekel' && value > kiloPrice) {
        invalid = `الخصم لا يزيد عن سعر الكيلو (${formatMoney(kiloPrice)} ₪).`;
    }

    // Once: what comes off the balance now; it may not take the balance below zero.
    const discount = isStanding || invalid ? null : discountAmount(data.method, data.value, owed, subscription.kiloPrice);

    if (!isStanding && value > 0 && !invalid) {
        if (owed <= 0) {
            invalid = 'لا يوجد رصيد مستحق على المشترك ليُخصم منه.';
        } else if (discount > owed) {
            invalid = `لا يمكن أن يزيد الخصم (${formatMoney(discount)} ₪) عن الرصيد المستحق (${formatMoney(owed)} ₪).`;
        }
    }

    const balanceAfter = discount === null || invalid ? null : Number(balance) - discount;

    // Standing: the last week read, or 10 kilos, at the subscription's prices, billed without and with it.
    const hasLastReading = Number(subscription.lastConsumption) > 0;
    const example = {
        kilos: hasLastReading ? Number(subscription.lastConsumption) : 10,
        unitPrice: subscription.kiloPrice,
        minimumPayment: subscription.minimumPayment,
        label: hasLastReading ? 'يدفع عن آخر قراءة' : 'يدفع عن 10 كيلو (مثال)',
    };
    const exampleBill = weeklyCharges(example.kilos, example.unitPrice, example.minimumPayment);
    const exampleWithDiscount =
        isStanding && value > 0 && !invalid ? weeklyCharges(example.kilos, example.unitPrice, example.minimumPayment, data) : exampleBill;
    const weeklySaving = Math.max(0, exampleBill.amountDue - exampleWithDiscount.amountDue);

    // The steps are numbered in the order they show: the kind (not when correcting), the weekly method and segment only for a standing discount.
    const stepNumbers = [!correcting && 'kind', isStanding && 'method', 'value', isStanding && 'segment', 'notes'].filter(Boolean);
    const steps = Object.fromEntries(stepNumbers.map((step, index) => [step, index + 1]));

    return {
        isStanding,
        kiloPrice,
        owed,
        value,
        field,
        methods,
        invalid,
        discount,
        balanceAfter,
        example,
        exampleBill,
        exampleWithDiscount,
        weeklySaving,
        steps,
    };
}
