import FormPage from '@/Components/FormPage';
import { useResourceForm } from '@/hooks/useResourceForm';
import SubscriptionForm, { SUBSCRIPTION_OUTLINE } from './SubscriptionForm';
import { subscriptionFormData } from '@/lib/subscriptionForm';

export default function Edit({
    subscription,
    branches,
    tariffs,
    segments,
    circuitBreakers,
    subAreas,
    canChooseBranch,
    currentBranchAreaId,
    currentBranchAreaName,
    canEditMinimumCharge,
    canEditKilowattPrice,
}) {
    const form = useResourceForm('/subscriptions', subscription, subscriptionFormData(subscription));

    return (
        <FormPage title="تعديل المشترك" form={form} cancelHref="/subscriptions" widthClass="max-w-6xl" outline={SUBSCRIPTION_OUTLINE} asideNote="رقم الحساب لا يتغيّر بالتعديل.">
            <SubscriptionForm
                data={form.data}
                setData={form.setData}
                errors={form.errors}
                clearErrors={form.clearErrors}
                branches={branches}
                meterBox={subscription.meter_box ?? null}
                tariffs={tariffs}
                segments={segments}
                circuitBreakers={circuitBreakers}
                subAreas={subAreas}
                canChooseBranch={canChooseBranch}
                currentBranchAreaId={currentBranchAreaId}
                currentBranchAreaName={currentBranchAreaName}
                canEditMinimumCharge={canEditMinimumCharge}
                canEditKilowattPrice={canEditKilowattPrice}
                subscriptionCount={subscription.subscriptionCount}
                isEdit
            />
        </FormPage>
    );
}
