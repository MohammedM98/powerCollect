/**
 * The form's starting values: the subscription's own when editing,
 * otherwise blank. New subscriptions start out waiting (قيد الانتظار).
 */
export function subscriptionFormData(subscription, sourceSubscription = null) {
    const data = {
        full_name: subscription?.full_name ?? '',
        subscription_name: subscription?.subscription_name ?? subscription?.full_name ?? '',
        national_id: subscription?.national_id ?? '',
        phone: subscription?.phone ?? '',
        subscription_phone: subscription?.subscription_phone ?? subscription?.phone ?? '',
        address: subscription?.address ?? '',
        meter_box_id: subscription?.meter_box_id ?? '',
        tariff_id: subscription?.tariff_id ?? '',
        tariff_segment_id: subscription?.tariff_segment_id ?? '',
        status: subscription?.status ?? 'suspended',
        accounting_type: subscription?.accounting_type ?? 'weekly',
        branch_id: subscription?.branch_id ?? '',
        circuit_breaker_id: subscription?.circuit_breaker_id ?? '',
        minimum_charge: subscription?.minimum_charge != null ? Number(subscription.minimum_charge) : '',
        // Empty means the subscriber pays their tariff's price.
        kilowatt_price: subscription?.kilowatt_price != null ? Number(subscription.kilowatt_price) : '',
        initial_reading: subscription?.initial_reading ?? '',
        subscription_fee: subscription?.subscription_fee ?? '',
        // New subscriptions, and existing ones whose fee is not on the account yet, can be charged it.
        ...(subscription?.subscription_fee_charged ? {} : { charge_subscription_fee: false }),
        subscription_date: subscription?.subscription_date ?? '',
        // Only read by the form: it is not a field the server takes.
        has_been_active: subscription?.has_been_active ?? false,
        subscription_fee_charged: subscription?.subscription_fee_charged ?? false,
        notes: subscription?.notes ?? '',
    };

    if (sourceSubscription) {
        Object.assign(data, {
            source_subscription_id: sourceSubscription.id,
            full_name: sourceSubscription.full_name,
            subscription_name: sourceSubscription.display_name ?? sourceSubscription.full_name,
            national_id: sourceSubscription.national_id,
            phone: sourceSubscription.phone ?? '',
            subscription_phone: sourceSubscription.contact_phone ?? sourceSubscription.phone ?? '',
            address: sourceSubscription.address ?? '',
            branch_id: sourceSubscription.branch_id,
        });
    }

    return data;
}
