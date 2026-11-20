import { Button } from '@heroui/react';
import Icon from '@/Components/Icon';
import { EmployeeAvatar, RoleChip } from './PermissionPeople';
import { RiskGauge } from './PermissionInsights';
import { copyWorkPermissions, individualChanges, permissionsWord } from '@/lib/permissions';
import { MenuButton, MenuItem } from './PermissionMenu';
import { Delta } from './PermissionReview';

/** The editor's dark header: who the employee is, how much they hold and how risky it is, copying a colleague, the role's template and the view tabs. */
export default function PermissionHero({
    activeTab,
    allCount,
    color,
    colorOf,
    copyFrom,
    copySources,
    counts,
    deviations,
    dirty,
    employee,
    grantedBy,
    heroRisk,
    locked,
    processing,
    sections,
    selected,
    setGuideAudience,
    setSelected,
    setTab,
    tabs,
    template,
}) {
    function onTabKeyDown(event) {
        const index = tabs.findIndex((item) => item.key === activeTab);
        const step = event.key === 'ArrowLeft' ? 1 : event.key === 'ArrowRight' ? -1 : 0;

        if (step) {
            event.preventDefault();
            const next = tabs[(index + step + tabs.length) % tabs.length];
            setTab(next.key);
            document.getElementById(`permission-tab-${next.key}`)?.focus();
        }
    }

    return (
        <section className="pm-hero rise-in" style={{ '--role': color }} aria-label={`صلاحيات ${employee.name}`}>
            <div className="pm-hero-main">
                <EmployeeAvatar name={employee.name} color={color} size="lg" />
                <div className="min-w-0 flex-1">
                    <h3 className="wrap-break-word text-2xl font-bold">{employee.name}</h3>
                    <p className="pm-hero-meta">
                        <RoleChip label={employee.roleLabel} color={color} className="on-dark" />
                        <span className="inline-flex items-center gap-1">
                            <Icon name="office" className="h-4 w-4" />
                            {employee.branchName ?? 'بلا فرع'}
                        </span>
                        <span className="font-display" dir="ltr">
                            @{employee.username}
                        </span>
                        {employee.isActive === false && <span className="pm-hero-flag">الحساب موقوف</span>}
                    </p>
                    <p className="pm-hero-stats">
                        <span>
                            <Icon name="key" className="h-4 w-4" />
                            <b className="font-display">{counts.total}</b> من <b className="font-display">{allCount}</b> {permissionsWord(allCount)}
                        </span>
                        <span className="is-danger">
                            <Icon name="alert" className="h-4 w-4" />
                            <b className="font-display">{counts.danger}</b> خطيرة
                        </span>
                        <span className="is-sensitive">
                            <Icon name="info" className="h-4 w-4" />
                            <b className="font-display">{counts.sensitive}</b> حساسة
                        </span>
                        <span className={`pm-hero-risk is-${heroRisk.level}`}>خطورة {heroRisk.label}</span>
                        {grantedBy.map(([name, count]) => (
                            <span key={name}>
                                <Icon name="user" className="h-4 w-4" />
                                منحه {name} <b className="font-display">{count}</b>
                            </span>
                        ))}
                        {locked.length > 0 && (
                            <span title={locked.join('، ')}>
                                <Icon name="lock" className="h-4 w-4" />
                                <b className="font-display">{locked.length}</b> خارج نطاق إدارتك
                            </span>
                        )}
                    </p>
                </div>
                <RiskGauge sections={sections} selected={selected} onDark />
            </div>

            <div className="pm-hero-actions">
                <Button className="pm-hero-button" onClick={() => setGuideAudience('selected')}>
                    <Icon name="document" className="h-4 w-4" />
                    دليل الموظف
                </Button>
                <MenuButton icon="users" label="نسخ من موظف" className="pm-hero-button">
                    {(close) =>
                        copySources.length === 0 ? (
                            <p className="px-3 py-4 text-center text-sm text-gray-500">لا يوجد موظفون آخرون في هذه الصفحة.</p>
                        ) : (
                            copySources.map((user) => {
                                const diff = individualChanges(sections, selected, copyWorkPermissions(sections, selected, user.permissionIds));

                                return (
                                    <MenuItem
                                        key={user.id}
                                        leading={<EmployeeAvatar name={user.name} color={colorOf(user.roleLabel)} size="sm" />}
                                        title={user.name}
                                        subtitle={`${user.roleLabel}، ${user.branchName ?? 'بلا فرع'}`}
                                        trailing={
                                            <Delta
                                                added={diff.filter((item) => item.added).length}
                                                removed={diff.filter((item) => !item.added).length}
                                            />
                                        }
                                        onSelect={() => {
                                            copyFrom(user);
                                            close();
                                        }}
                                    />
                                );
                            })
                        )
                    }
                </MenuButton>
            </div>

            {template && (
                <p className="pm-hero-template">
                    <Icon name="shield" className="h-[18px] w-[18px]" />
                    {deviations === 0 ? (
                        <span>
                            مطابق تمامًا لقالب <b>«{template.label}»</b>
                        </span>
                    ) : (
                        <span>
                            مخصّص: <b className="font-display">{deviations}</b> {deviations === 1 ? 'اختلاف' : 'اختلافات'} عن قالب{' '}
                            <b>«{template.label}»</b>
                        </span>
                    )}
                    {deviations > 0 && (
                        <Button
                            onClick={() => setSelected([...template.permissionIds])}
                            isDisabled={processing}
                            className="ms-auto font-semibold underline-offset-4 hover:underline"
                        >
                            إعادة إلى القالب
                        </Button>
                    )}
                </p>
            )}

            <div className="pm-tabs" role="tablist" aria-label="عرض صلاحيات الموظف">
                {tabs.map((item) => (
                    <Button
                        key={item.key}
                        id={`permission-tab-${item.key}`}
                        role="tab"
                        aria-selected={activeTab === item.key}
                        aria-controls={`permission-view-${item.key}`}
                        tabIndex={activeTab === item.key ? 0 : -1}
                        onClick={() => setTab(item.key)}
                        onKeyDown={onTabKeyDown}
                        className={`pm-tab ${activeTab === item.key ? 'is-active' : ''}`}
                    >
                        <Icon name={item.icon} className="h-4 w-4" />
                        {item.label}
                        {item.key === 'matrix' && dirty && <span className="pm-unsaved" title="تغييرات لم تُحفظ" />}
                    </Button>
                ))}
            </div>
        </section>
    );
}
