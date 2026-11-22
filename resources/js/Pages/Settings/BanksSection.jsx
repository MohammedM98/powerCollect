import { useEffect, useState } from 'react';
import { useForm } from '@inertiajs/react';
import FormModal from '@/Components/Form/FormModal';
import FormField from '@/Components/Form/FormField';
import FormSection from '@/Components/Form/FormSection';
import FormPreview, { countFilled } from '@/Components/Form/FormPreview';
import Icon from '@/Components/UI/Icon';
import DataTableToolbar from '@/Components/DataTable/DataTableToolbar';
import RowActionsMenu from '@/Components/DataTable/RowActionsMenu';
import Pagination from '@/Components/DataTable/Pagination';
import { BankMark } from '@/Components/Finance/Banks';
import SettingRow from '@/Components/Form/SettingRow';
import InputError from '@/Components/UI/InputError';
import { SettingsHeading } from '@/Components/Settings/SettingsKit';
import { AddKey, ListBody, ListCell, ListColumn, ListHeader, ListRow, ListTable, StatusPill, Switch, TextInput } from '@/Components/UI';

function BankLogoInput({ id, file, currentLogo, bankName, onChange, disabled, ...props }) {
    const [preview, setPreview] = useState(null);

    useEffect(() => {
        if (!file || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
            setPreview(null);
            return;
        }

        const url = URL.createObjectURL(file);
        setPreview(url);
        return () => URL.revokeObjectURL(url);
    }, [file]);

    const image = preview ?? (!file ? currentLogo : null);

    return <div className="ma-inline-add ma-file-pick">
        <span className="ma-file-thumb">
            {image ? <img src={image} alt={`شعار ${bankName || 'البنك أو المحفظة'}`} className="h-full w-full object-contain p-1" /> : <Icon name="bank" className="h-7 w-7" />}
        </span>
        <div className="min-w-0 flex-1 basis-40">
            <p className="ma-file-name">{file ? 'الشعار المختار' : currentLogo ? 'الشعار الحالي' : 'شعار البنك أو المحفظة'}</p>
            <p className="ma-field-hint break-all" dir="auto">{file?.name ?? (currentLogo ? 'سيبقى محفوظًا ما لم تختر صورة أخرى.' : 'لم يتم اختيار صورة بعد.')}</p>
        </div>
        <div className="relative shrink-0">
            <input {...props} id={id} name="logo" type="file" accept="image/png,image/jpeg,image/webp" disabled={disabled} className="peer sr-only" onChange={(event) => onChange(event.target.files?.[0] ?? null)} />
            <label htmlFor={id} className="ma-file-key" data-disabled={disabled ? '' : undefined}>
                <Icon name="plus" className="h-4 w-4" />{file || currentLogo ? 'تغيير الشعار' : 'اختيار الشعار'}
            </label>
        </div>
    </div>;
}

function BankModal({ bank, storeUrl, onClose }) {
    const form = useForm({ name: bank?.name ?? '', is_receiver: bank?.is_receiver ?? true, is_sender: bank?.is_sender ?? true, is_active: bank?.is_active ?? true, logo: null, _method: bank ? 'put' : 'post' });
    const resourceForm = { ...form, isEdit: Boolean(bank), save: (options) => form.post(bank?.updateUrl ?? storeUrl, { ...options, forceFormData: true }) };

    return <FormModal show onClose={onClose} form={resourceForm} title={bank ? 'تعديل البنك' : 'إضافة بنك أو محفظة'} icon="bank" maxWidth="3xl">
        <div className="space-y-6">
            <FormPreview avatar={<Icon name="bank" className="h-6 w-6 text-white/70" />} dotClass={form.data.is_active ? 'bg-emerald-500' : 'bg-gray-400'} title={form.data.name.trim() || 'بنك أو محفظة جديدة'} chips={[form.data.is_receiver && 'البنك المستلم', form.data.is_sender && 'البنك المرسل', form.data.is_active ? 'نشط' : 'غير نشط'].filter(Boolean)} filled={countFilled(form.data, ['name'])} total={1} />
            <FormSection icon="bank" title="بيانات البنك أو المحفظة" description="الاسم والشعار الذي يظهر عند تسجيل الدفعة" columns={1}>
                <FormField id="bank-name" label="الاسم" required error={form.errors.name}><TextInput name="name" required maxLength={255} className="w-full" value={form.data.name} onChange={(event) => form.setData('name', event.target.value)} /></FormField>
                <FormField id="bank-logo" label="الشعار" hint="PNG أو JPG أو WebP، بحد أقصى 2 ميجابايت." error={form.errors.logo}>
                    <BankLogoInput file={form.data.logo} currentLogo={bank?.logoUrl} bankName={form.data.name} disabled={form.processing} onChange={(file) => form.setData('logo', file)} />
                </FormField>
            </FormSection>
            <FormSection icon="card" title="الاستخدام والحالة" description="أين يُعرض هذا البنك وهل هو متاح الآن" columns={1}>
                <div>
                    <SettingRow title="البنك المستلم" description="متاح لاستلام دفعات المشتركين">
                        <Switch id="bank-receiver" checked={form.data.is_receiver} onChange={(value) => form.setData('is_receiver', value)} ariaLabel="متاح لاستلام دفعات المشتركين" />
                    </SettingRow>
                    <InputError message={form.errors.is_receiver} className="mt-1" />
                </div>
                <div>
                    <SettingRow title="البنك المرسل" description="متاح كبنك مرسل">
                        <Switch id="bank-sender" checked={form.data.is_sender} onChange={(value) => form.setData('is_sender', value)} ariaLabel="متاح كبنك مرسل" />
                    </SettingRow>
                    <InputError message={form.errors.is_sender} className="mt-1" />
                </div>
                <div>
                    <SettingRow title="الحالة" description="نشط ويظهر عند تسجيل دفعة جديدة">
                        <Switch id="bank-active" checked={form.data.is_active} onChange={(value) => form.setData('is_active', value)} ariaLabel="نشط ويظهر عند تسجيل دفعة جديدة" />
                    </SettingRow>
                    <InputError message={form.errors.is_active} className="mt-1" />
                </div>
            </FormSection>
        </div>
    </FormModal>;
}

export default function BanksSection({ banks, storeUrl }) {
    const [editing, setEditing] = useState(null);
    const [creating, setCreating] = useState(false);
    const [search, setSearch] = useState('');
    const [perPage, setPerPage] = useState(15);
    const [page, setPage] = useState(1);
    const filtered = banks.filter((bank) => bank.name.includes(search.trim()));
    const lastPage = Math.max(1, Math.ceil(filtered.length / perPage));
    const currentPage = Math.min(page, lastPage);
    const shown = filtered.slice((currentPage - 1) * perPage, currentPage * perPage);
    const meta = { current_page: currentPage, last_page: lastPage, from: (currentPage - 1) * perPage + 1, to: Math.min(currentPage * perPage, filtered.length), total: filtered.length };

    return <section aria-labelledby="payment-banks-title" className="space-y-4">
        <SettingsHeading id="payment-banks-title" icon="bank" tone="split" title="البنوك والمحافظ" description="البنوك والمحافظ التي تُستلم بها دفعات المشتركين أو تُرسل منها، وشعار كل منها." action={<AddKey onClick={() => setCreating(true)}>إضافة بنك أو محفظة</AddKey>} />
        <DataTableToolbar search={search} onSearchChange={(value) => { setSearch(value); setPage(1); }} perPage={perPage} onPerPageChange={(value) => { setPerPage(value); setPage(1); }} placeholder="ابحث باسم البنك أو المحفظة" total={filtered.length} printable={false} />
        <div className="data-table-container"><ListTable aria-label="البنوك والمحافظ" className="data-table w-full text-start text-sm">
            <ListHeader><ListColumn id="name" isRowHeader>البنك أو المحفظة</ListColumn><ListColumn id="usage">الاستخدام</ListColumn><ListColumn id="status">الحالة</ListColumn><ListColumn actions /></ListHeader>
            <ListBody empty={<span className="text-gray-500">لا توجد بنوك مطابقة.</span>}>{shown.map((bank) => <ListRow key={bank.id} id={bank.id}>
                <ListCell><div className="flex items-center gap-3"><BankMark bank={bank.name} /><span className="font-semibold text-gray-900">{bank.name}</span></div></ListCell>
                <ListCell className="text-gray-600">{[bank.is_receiver && 'استلام', bank.is_sender && 'إرسال'].filter(Boolean).join(' و')}</ListCell>
                <ListCell><StatusPill label={bank.is_active ? 'نشط' : 'غير نشط'} tone={bank.is_active ? 'green' : 'gray'} /></ListCell>
                <ListCell><RowActionsMenu onEdit={() => setEditing(bank)} /></ListCell>
            </ListRow>)}</ListBody>
        </ListTable></div>
        <Pagination meta={meta} onPageChange={setPage} />
        {(creating || editing) && <BankModal key={editing?.id ?? 'new'} bank={editing} storeUrl={storeUrl} onClose={() => { setCreating(false); setEditing(null); }} />}
    </section>;
}
