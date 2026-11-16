import { useEffect } from 'react';
import { router, usePage } from '@inertiajs/react';
import FormPage from '@/Components/FormPage';
import { useResourceForm } from '@/hooks/useResourceForm';
import SubscriptionForm from './SubscriptionForm';
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
    const canViewList = Boolean(usePage().props.can?.viewSubscriptions);
    useEffect(() => {
        if (canViewList) router.get('/subscriptions', { create: '1' }, { replace: true });
    }, [canViewList]);
    const form = useResourceForm('/subscriptions', null, subscriptionFormData(null));

    if (canViewList) return <p className="p-5 text-gray-600" role="status">جارٍ فتح النافذة…</p>;

    return (
        <FormPage title="إنشاء مشترك" form={form} cancelHref="/subscriptions" widthClass="max-w-6xl">
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
