import { useState } from 'react';
import { Button, Card, Chip, SearchField } from '@heroui/react';
import { Head, router, usePage } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import Icon from '@/Components/Icon';
import InputError from '@/Components/InputError';
import PageHeader from '@/Components/PageHeader';
import { formatNumber, formatDate } from '@/lib/format';
import { readingSearchMatches } from '@/lib/readingBoard';
import { Figure, SegmentedChoice } from '@/Components/UI';


function BranchOverview({ branches, canCreate }) {
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState('all');
    const [preparingId, setPreparingId] = useState(null);
    const { errors } = usePage().props;
    const prepared = branches.filter((item) => item.cycleId).length;
    const visible = branches.filter((item) => readingSearchMatches(item.name, search)
        && (status === 'all' || (status === 'prepared' ? Boolean(item.cycleId) : !item.cycleId)));

    function prepare(item) {
        router.post('/reading-cycles/prepare', { branch_id: item.id }, {
            preserveScroll: true,
            onStart: () => setPreparingId(item.id),
            onFinish: () => setPreparingId(null),
        });
    }

    return (
        <div className="space-y-5">
            <section aria-label="ملخص تجهيز القراءات" className="gl-rp-figs">
                <Figure dark label="الفروع" hint={visible[0] ? `القراءة القادمة ${visible[0].readingDayName} ${formatDate(visible[0].readingDate)}` : 'اختر الفرع لمراجعة توزيعه'}>{formatNumber(branches.length)}</Figure>
                <Figure tone="pay" label="قراءات مجهّزة" hint="تُتاح مهامها للقرّاء قبل يوم القراءة">{formatNumber(prepared)}</Figure>
                <Figure tone={branches.length - prepared > 0 ? 'warn' : null} label="بانتظار التجهيز" hint="جهّز التوزيع ليصل القرّاء">{formatNumber(branches.length - prepared)}</Figure>
            </section>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <SearchField aria-label="بحث عن فرع" value={search} onChange={setSearch} className="w-full sm:max-w-sm">
                    <SearchField.Group>
                        <SearchField.SearchIcon />
                        <SearchField.Input placeholder="بحث عن فرع..." />
                        <SearchField.ClearButton />
                    </SearchField.Group>
                </SearchField>
                <div className="max-w-full overflow-x-auto pb-1">
                    <SegmentedChoice label="حالة تجهيز القراءة" value={status} onChange={setStatus} options={[
                        { value: 'all', label: `الكل (${formatNumber(branches.length)})` },
                        { value: 'prepared', label: `مجهّزة (${formatNumber(prepared)})` },
                        { value: 'waiting', label: `بانتظار التجهيز (${formatNumber(branches.length - prepared)})` },
                    ]} />
                </div>
            </div>
            <InputError message={errors?.branch_id} />

            {visible.length > 0 && (
                <Card className="gl-rp-panel" data-excel-source="custom">
                    <Card.Content>
                        <div className="gl-rp-scroll">
                            <table className="gl-rp-table" aria-label="الفروع وموعد القراءة القادمة">
                                <thead>
                                    <tr>
                                        <th>الفرع</th>
                                        <th>القراءة القادمة</th>
                                        <th>التوزيع</th>
                                        <th><span className="sr-only">الإجراء</span></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {visible.map((item) => (
                                        <tr key={item.id} aria-busy={preparingId === item.id}>
                                            <td><b id={`distribution-branch-${item.id}`}>{item.name}</b></td>
                                            <td>{item.readingDayName} <time dateTime={item.readingDate} dir="ltr">{formatDate(item.readingDate)}</time></td>
                                            <td><Chip size="sm" variant="soft" className="gl-rp-chip" data-tone={item.cycleId ? 'pay' : 'warn'}>{item.cycleId ? 'مجهّزة' : 'بانتظار التجهيز'}</Chip></td>
                                            <td className="is-end">
                                                {item.cycleId ? (
                                                    <Button variant="secondary" onPress={() => router.visit(`/reading-cycles/${item.cycleId}`)} aria-label={`فتح توزيع ${item.name}`}>
                                                        فتح التوزيع
                                                        <Icon name="chevron-left" className="h-4 w-4 shrink-0" />
                                                    </Button>
                                                ) : canCreate ? (
                                                    <Button variant="secondary" isDisabled={preparingId !== null} onPress={() => prepare(item)} aria-label={`تجهيز وفتح توزيع ${item.name}`}>
                                                        <Icon name={preparingId === item.id ? 'clock' : 'plus'} className="h-4 w-4 shrink-0" />
                                                        {preparingId === item.id ? 'جارٍ تجهيز القراءة...' : 'تجهيز وفتح التوزيع'}
                                                    </Button>
                                                ) : <span className="text-sm text-gray-500">بانتظار تجهيز مسؤول التوزيع.</span>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card.Content>
                </Card>
            )}

            {visible.length === 0 && (
                <Card className="gl-rp-panel items-center gap-3 px-5 py-12 text-center">
                    <Icon name={branches.length ? 'search' : 'office'} className="h-9 w-9 text-gray-400" />
                    <h3 className="font-bold text-gray-900">{branches.length ? 'لا توجد فروع مطابقة' : 'لا توجد فروع متاحة للتوزيع'}</h3>
                    <p className="text-sm text-gray-500">{branches.length ? 'غيّر اسم الفرع أو حالة التجهيز لعرض نتائج أخرى.' : 'تظهر هنا الفروع المفعّلة عند إضافتها.'}</p>
                    {branches.length > 0 && <Button variant="secondary" onPress={() => { setSearch(''); setStatus('all'); }}>إظهار كل الفروع</Button>}
                </Card>
            )}
        </div>
    );
}

/** Only the upcoming reading is presented; branch staff open it directly. */
export default function Index({ distributionBranches = [], canCreate, branch }) {
    return (
        <AuthenticatedLayout header={<PageHeader title="توزيع القراءة القادمة" info="يبقى توزيع الطبلونات على القرّاء كما هو لكل قراءة قادمة، حتى يغيّره مسؤول التوزيع." />}>
            <Head title="توزيع القراءة القادمة" />
            {branch ? (
                <div className="space-y-3 text-gray-700">
                    <h2 className="text-lg font-bold text-gray-900">القراءة القادمة {formatDate(branch.readingDate)}</h2>
                    <p>لم يُجهّز توزيع هذه القراءة بعد. سيظهر هنا بعد تجهيز مسؤول التوزيع له.</p>
                </div>
            ) : (
                <BranchOverview branches={distributionBranches} canCreate={canCreate} />
            )}
        </AuthenticatedLayout>
    );
}
