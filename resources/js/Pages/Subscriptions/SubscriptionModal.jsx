import { useState } from 'react';
import { router } from '@inertiajs/react';
import FormModal from '@/Components/FormModal';
import { useResourceForm } from '@/hooks/useResourceForm';
import { urlWith } from '@/lib/pageUrl';
import SubscriptionForm, { SUBSCRIPTION_OUTLINE } from './SubscriptionForm';
import { subscriptionFormData } from '@/lib/subscriptionForm';

export default function SubscriptionModal({
    show,
    onClose,
    subscription,
    sourceSubscription = null,
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
    visitOptions,
}) {
    // The preview reads the same values that are submitted to the server.
    const initialData = subscriptionFormData(subscription, sourceSubscription);
    const form = useResourceForm('/subscriptions', subscription, initialData);
    const [formVersion, setFormVersion] = useState(0);
    const creating = !form.isEdit;

    function saveAnother(page) {
        if (page.component === 'Subscriptions/Index') {
            const url = urlWith(page.url, { create: '1' });
            if (url !== page.url) router.replace({ url, preserveScroll: true, preserveState: true });
        }

        form.setDefaults(initialData);
        form.setData(initialData);
        form.clearErrors();
        setFormVersion((current) => current + 1);
    }

    return (
        <FormModal
            show={show}
            onClose={onClose}
            form={form}
            title={form.isEdit ? 'تعديل المشترك' : sourceSubscription ? 'إضافة اشتراك' : 'إضافة مشترك'}
            icon={creating ? 'user-plus' : 'user'}
            description={form.isEdit ? 'التغييرات تظهر في كشف الحساب والقراءات القادمة.' : 'يُنشأ رقم الحساب تلقائيًا عند الحفظ.'}
            maxWidth="5xl"
            visitOptions={visitOptions}
            outline={creating ? null : SUBSCRIPTION_OUTLINE}
            bodyClassName={creating ? 'gl-resource-create-body' : undefined}
            className={creating ? 'gl-resource-create-dialog' : undefined}
            confirmBeforeSave={!creating || Boolean(sourceSubscription)}
            validateOnBlur={creating}
            action={creating && !sourceSubscription ? { submitLabel: 'حفظ المشترك' } : null}
            onSaveAnother={creating && !sourceSubscription ? saveAnother : undefined}
        >
            <SubscriptionForm
                key={formVersion}
                data={form.data}
                setData={form.setData}
                errors={form.errors}
                clearErrors={form.clearErrors}
                branches={branches}
                meterBox={subscription?.meter_box ?? null}
                tariffs={tariffs}
                segments={segments}
                circuitBreakers={circuitBreakers}
                subAreas={subAreas}
                canChooseBranch={canChooseBranch}
                currentBranchAreaId={currentBranchAreaId}
                currentBranchAreaName={currentBranchAreaName}
                canEditMinimumCharge={canEditMinimumCharge}
                canEditKilowattPrice={canEditKilowattPrice}
                sharedPersonalDetails={Boolean(sourceSubscription)}
                isEdit={form.isEdit}
                sidePreview={creating}
                subscriptionCount={subscription?.subscriptionCount ?? 1}
            />
        </FormModal>
    );
}
