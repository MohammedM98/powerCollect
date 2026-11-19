import FormPage from '@/Components/FormPage';
import { useResourceForm } from '@/hooks/useResourceForm';
import SubscriptionForm, { SUBSCRIPTION_OUTLINE } from './SubscriptionForm';
import { subscriptionFormData } from '@/lib/subscriptionForm';

export default function Create({
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
    const form = useResourceForm('/subscriptions', null, subscriptionFormData(null));

    return (
        <FormPage title="إنشاء مشترك" form={form} cancelHref="/subscriptions" widthClass="max-w-6xl" outline={SUBSCRIPTION_OUTLINE} asideNote="يُنشأ رقم الحساب تلقائيًا عند الحفظ.">
            <SubscriptionForm
                data={form.data}
                setData={form.setData}
                errors={form.errors}
                clearErrors={form.clearErrors}
                branches={branches}
                tariffs={tariffs}
                segments={segments}
                circuitBreakers={circuitBreakers}
                subAreas={subAreas}
                canChooseBranch={canChooseBranch}
                currentBranchAreaId={currentBranchAreaId}
                currentBranchAreaName={currentBranchAreaName}
                canEditMinimumCharge={canEditMinimumCharge}
                canEditKilowattPrice={canEditKilowattPrice}
            />
        </FormPage>
    );
}
