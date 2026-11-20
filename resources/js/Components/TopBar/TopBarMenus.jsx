import { router, usePage } from '@inertiajs/react';
import { Button, Dropdown, Label, ListBox, Popover, Select } from '@heroui/react';
import Icon from '@/Components/Icon';
import SegmentedChoice from '@/Components/SegmentedChoice';
import { useBranchView } from '@/hooks/useBranchView';
import { useSurface } from '@/hooks/useSurface';
import { useTheme } from '@/hooks/useTheme';

/** «All branches» in the picker: the empty value, as the server reads it. */
const ALL_BRANCHES = 'all';

/**
 * The super admin's working branch in the top bar, on every page: HeroUI's
 * Select on the frosted pop surface, with all branches first. The choice
 * stays for the rest of the visit, across pages (useBranchView).
 */
export function WorkingBranchSelect() {
    const { branchView } = usePage().props;
    const view = useBranchView();

    if (!branchView) {
        return null;
    }

    const options = [{ id: ALL_BRANCHES, name: 'كل الفروع' }, ...branchView.options.map((branch) => ({ id: String(branch.id), name: branch.name }))];

    return (
        <Select
            aria-label="تغيير فرع العمل"
            className="tn-branch-select"
            selectedKey={branchView.current?.id ? String(branchView.current.id) : ALL_BRANCHES}
            onSelectionChange={(key) => view.changeBranch(key === ALL_BRANCHES ? '' : String(key))}
            isDisabled={view.switching}
        >
            <Label className="sr-only">فرع العمل</Label>
            <Select.Trigger className="tn-branch-trigger" title="فرع العمل: يبقى اختيارك معك أثناء التنقل حتى تغيّره">
                <Icon name="building" className="h-[18px] w-[18px] shrink-0" />
                <Select.Value />
                <Select.Indicator />
            </Select.Trigger>
            <Select.Popover className="tn-branch-pop" placement="bottom end">
                <ListBox aria-label="الفروع">
                    {options.map((branch) => (
                        <ListBox.Item key={branch.id} id={branch.id} textValue={branch.name}>
                            {branch.id === ALL_BRANCHES ? <Icon name="layers" className="h-4 w-4 shrink-0" /> : <Icon name="building" className="h-4 w-4 shrink-0" />}
                            {branch.name}
                            <ListBox.ItemIndicator />
                        </ListBox.Item>
                    ))}
                </ListBox>
            </Select.Popover>
        </Select>
    );
}

const THEMES = [
    { value: 'light', label: <><Icon name="sun" className="h-4 w-4" />فاتح</> },
    { value: 'dark', label: <><Icon name="moon" className="h-4 w-4" />داكن</> },
    { value: 'auto', label: <><Icon name="theme-auto" className="h-4 w-4" />تلقائي</> },
];

const SURFACES = [
    { value: 'glass', label: <><Icon name="layers" className="h-4 w-4" />زجاجي</> },
    { value: 'solid', label: <><Icon name="rows-compact" className="h-4 w-4" />مصمت</> },
];

/**
 * The appearance, from one key in the top bar: light, dark or the device's,
 * glass or solid surfaces, and the keyboard shortcuts and the quick tour.
 */
export function AppearanceMenu({ onShowShortcuts, onStartTour }) {
    const { dark, preference, changePreference } = useTheme();
    const { surface, changeSurface } = useSurface();

    return (
        <Popover>
            <Button isIconOnly variant="ghost" className="tn-tool" aria-label="المظهر" data-tour="appearance">
                <Icon name={dark ? 'moon' : 'sun'} />
            </Button>
            <Popover.Content className="tn-appearance gl-pop" placement="bottom end">
                <Popover.Dialog aria-label="المظهر">
                    <p className="tn-appearance-title">المظهر</p>
                    <SegmentedChoice label="الوضع" value={preference} onChange={changePreference} options={THEMES} className="tn-appearance-seg" />
                    <p className="tn-appearance-title">الأسطح</p>
                    <SegmentedChoice label="شكل الأسطح" value={surface} onChange={changeSurface} options={SURFACES} className="tn-appearance-seg" />
                    <div className="tn-appearance-more">
                        <Button variant="ghost" onPress={onShowShortcuts}><Icon name="keyboard" className="h-4 w-4" />اختصارات لوحة المفاتيح<span className="tn-kbd ms-auto">?</span></Button>
                        <Button variant="ghost" onPress={onStartTour}><Icon name="sparkles" className="h-4 w-4" />جولة سريعة في الشريط</Button>
                    </div>
                </Popover.Dialog>
            </Popover.Content>
        </Popover>
    );
}

/**
 * The «+» key: adding a subscriber, recording a payment, and a financial
 * line (charge, discount, clearing) for a subscriber, picked through the
 * search, whose statement holds those forms. Only what the user may do.
 */
export function QuickActionsMenu({ onPickSubscriber }) {
    const { can } = usePage().props;
    const actions = [
        can?.createSubscriptions && { id: 'subscriber', icon: 'users', tone: 'blue', label: 'مشترك جديد', run: () => router.visit('/subscriptions?create=1') },
        can?.recordPayments && { id: 'payment', icon: 'banknotes', tone: 'emerald', label: 'تسجيل دفعة', run: () => router.visit('/payments') },
        can?.viewSubscriptions && { id: 'transaction', icon: 'document-plus', tone: 'amber', label: 'حركة مالية لمشترك…', hint: 'تحميل، خصم، مقاصة', run: onPickSubscriber },
    ].filter(Boolean);

    if (actions.length === 0) {
        return null;
    }

    return (
        <Dropdown>
            <Dropdown.Trigger className="button button--secondary button--md tn-quick" aria-label="إضافة سريعة">
                <Icon name="plus" className="h-4 w-4" strokeWidth={2.2} />
                <span className="tn-quick-text">إضافة</span>
            </Dropdown.Trigger>
            <Dropdown.Popover className="gl-pop tn-quick-pop" placement="bottom end">
                <Dropdown.Menu aria-label="إضافة سريعة" onAction={(key) => actions.find((action) => action.id === key)?.run()}>
                    {actions.map((action) => (
                        <Dropdown.Item key={action.id} id={action.id} textValue={action.label}>
                            <span className="row-menu-ico" data-menu-tone={action.tone}><Icon name={action.icon} className="h-4 w-4" /></span>
                            <span className="grid">
                                <b>{action.label}</b>
                                {action.hint && <small>{action.hint}</small>}
                            </span>
                        </Dropdown.Item>
                    ))}
                </Dropdown.Menu>
            </Dropdown.Popover>
        </Dropdown>
    );
}
