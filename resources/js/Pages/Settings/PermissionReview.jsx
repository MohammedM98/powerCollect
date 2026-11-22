import DialogFrame from '@/Components/UI/DialogFrame';
import Icon from '@/Components/UI/Icon';
import { permissionsWord } from '@/lib/permissions';
import { RiskBadge } from './PermissionMatrix';
import { CheckBox, Notice, PrimaryKey, SecondaryKey } from '@/Components/UI';

/** «+3 −1»: what a change would grant and take away. */
export function Delta({ added, removed }) {
    return (
        <bdi dir="ltr" className="pm-delta">
            {added > 0 && <span className="is-added">+{added}</span>}
            {removed > 0 && <span className="is-removed">−{removed}</span>}
            {added === 0 && removed === 0 && <span>=</span>}
        </bdi>
    );
}

/**
 * Every change before it is saved, grouped by section: each permission
 * that will be granted or taken away, with what it opens and its risk.
 */
export function PermissionChangeReview({ employee, changes }) {
    const bySection = changes.reduce((groups, change) => {
        (groups[change.section] ??= []).push(change);
        return groups;
    }, {});

    return (
        <div className="space-y-4">
            <Notice title={`${employee.name}، ${employee.roleLabel}، ${employee.branchName ?? 'بلا فرع'}`}>
                لا تتغيّر الصلاحيات خارج نطاق إدارتك.
            </Notice>
            <div role="region" className="space-y-3" aria-label="جميع تغييرات الصلاحيات">
                {Object.entries(bySection).map(([section, items]) => (
                    <section key={section} className="overflow-hidden rounded-[14px] border border-(--ma-line)">
                        <h4 className="bg-(--ma-tile) px-3 py-2 text-sm font-bold text-(--ma-ink)">{section}</h4>
                        <ul className="space-y-1 p-2">
                            {items.map((change) => (
                                <li
                                    key={change.id}
                                    className={`flex items-start gap-3 rounded-[10px] px-3 py-2 ${change.added ? 'bg-(--ma-pay-s)' : 'bg-(--ma-tile)'}`}
                                >
                                    <b
                                        className={`w-3 text-center ${change.added ? 'text-(--ma-pay)' : 'text-(--ma-muted)'}`}
                                    >
                                        {change.added ? '+' : '−'}
                                    </b>
                                    <div className="min-w-0 flex-1">
                                        <p
                                            className={`flex flex-wrap items-center gap-2 text-sm font-semibold ${change.added ? 'text-(--ma-ink)' : 'text-(--ma-muted) line-through'}`}
                                        >
                                            {change.label}
                                            {change.added && <RiskBadge risk={change.risk} />}
                                        </p>
                                        {change.hint && <p className="text-xs text-(--ma-muted)">{change.hint}</p>}
                                    </div>
                                    <span
                                        className={`shrink-0 text-xs font-bold ${change.added ? 'text-(--ma-pay)' : 'text-(--ma-muted)'}`}
                                    >
                                        {change.added ? 'سيُمنح' : 'سيُلغى'}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </section>
                ))}
            </div>
        </div>
    );
}

/** The bar at the bottom while there are unsaved changes: how many, what they grant and take away, and undo or review. */
export function PermissionSaveBar({ dirty, errors, changes, auditChanges, firstName, added, removed, dangerousGrants, processing, onDiscard, onSave }) {
    return (
        <div role="region" aria-label="تغييرات لم تُحفظ" className={`pm-savebar ${dirty ? 'is-visible' : ''}`} aria-hidden={!dirty} inert={!dirty}>
            {Object.keys(errors).length > 0 && (
                <p className="pm-savebar-error" role="alert">
                    تعذّر حفظ الصلاحيات: {Object.values(errors)[0]}
                </p>
            )}
            <p className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-sm" role="status">
                <bdi dir="ltr" className="pm-savebar-count">{changes.length + auditChanges.length}</bdi>
                <span>تغييرات لم تُحفظ لـ {firstName}</span>
                {changes.length > 0 && <Delta added={added} removed={removed} />}
                {dangerousGrants.length > 0 && (
                    <span className="pm-savebar-danger">
                        <Icon name="alert" className="h-3.5 w-3.5" />
                        {dangerousGrants.length} خطيرة
                    </span>
                )}
            </p>
            <SecondaryKey onClick={onDiscard} disabled={processing || !dirty}>
                <Icon name="undo" className="h-4 w-4" />
                تراجع
            </SecondaryKey>
            <PrimaryKey type="button" onClick={onSave} disabled={processing || !dirty} title="Ctrl + S">
                <Icon name="check" className="h-4 w-4" strokeWidth={2} />
                {processing ? 'جارٍ الحفظ...' : 'مراجعة وحفظ'}
            </PrimaryKey>
        </div>
    );
}

/**
 * The review before saving: before and after counts, every change, what is
 * taken back from those the employee granted it to, the audit work's changes,
 * and the acknowledgement dangerous grants need.
 */
export function PermissionReviewDialog({
    show,
    employee,
    changes,
    auditChanges,
    keyChanges,
    takenFromOthers,
    dangerousGrants,
    added,
    removed,
    before,
    after,
    heroRisk,
    firstName,
    acknowledged,
    onAcknowledgedChange,
    dirty,
    processing,
    onCancel,
    onConfirm,
}) {
    const summary = [
        `${added} تُمنح، ${removed} تُلغى`,
        auditChanges.length > 0 && `${auditChanges.length} تغييرات في عمل التدقيق`,
        keyChanges.added + keyChanges.removed > 0 && `حق المنح: ${keyChanges.added} يُعطى، ${keyChanges.removed} يُسحب`,
    ].filter(Boolean).join('، ');

    const footer = (
        <>
            <SecondaryKey onClick={onCancel} disabled={processing} autoFocus>
                العودة للتعديل
            </SecondaryKey>
            <PrimaryKey type="button" onClick={onConfirm} disabled={processing || !dirty || (dangerousGrants.length > 0 && !acknowledged)}>
                {processing ? 'جارٍ الحفظ...' : 'تأكيد وحفظ الصلاحيات'}
            </PrimaryKey>
        </>
    );

    return (
        <DialogFrame
            show={show}
            onClose={onCancel}
            title="مراجعة تغييرات الصلاحيات"
            description={summary}
            icon="shield"
            tone={dangerousGrants.length > 0 ? 'danger' : 'primary'}
            maxWidth="2xl"
            busy={processing}
            footer={footer}
        >
            <div className="space-y-4">
                <div className="pm-review-strip">
                    <span>
                        قبل: <b className="font-display">{before.total}</b> {permissionsWord(before.total)}، منها{' '}
                        <b className="font-display">{before.danger}</b> خطيرة
                    </span>
                    <Icon name="arrow-left" className="h-4 w-4 shrink-0 text-(--ma-faint)" />
                    <span>
                        بعد: <b className="font-display">{after.total}</b> {permissionsWord(after.total)}، منها{' '}
                        <b className={`font-display ${after.danger > before.danger ? 'is-more' : ''}`}>{after.danger}</b> خطيرة
                    </span>
                    <span className={`pm-review-level is-${heroRisk.level}`}>خطورة {heroRisk.label}</span>
                </div>
                <PermissionChangeReview employee={employee} changes={changes} />
                {takenFromOthers.length > 0 && (
                    <Notice tone="warn">
                        تُسحب أيضًا من الموظفين الذين منحهم {firstName} إياها:{' '}
                        <strong>{takenFromOthers.map((change) => `${change.text} (${employee.grantsGiven[change.id]})`).join('، ')}</strong>
                    </Notice>
                )}
                {auditChanges.length > 0 && (
                    <div className="space-y-3 rounded-[14px] border border-(--ma-line) p-4">
                        <h3 className="font-bold text-(--ma-ink)">تغييرات عمل التدقيق</h3>
                        {auditChanges.map((change) => (
                            <div key={change.key} className="text-sm leading-7">
                                <b className="text-(--ma-ink)">{change.label}</b>
                                <p className="text-(--ma-muted)">قبل: {change.before}</p>
                                <p className="font-semibold text-(--ma-ink)">بعد: {change.after}</p>
                            </div>
                        ))}
                    </div>
                )}
                {dangerousGrants.length > 0 && (
                    <Notice tone="danger">
                        <label className="flex cursor-pointer items-start gap-3">
                            <CheckBox checked={acknowledged} onChange={(event) => onAcknowledgedChange(event.target.checked)} />
                            <span>
                                يحصل {firstName} على صلاحيات خطيرة: <strong>{dangerousGrants.map((item) => item.label).join('، ')}</strong>. أؤكد أنه
                                يحتاجها لعمله.
                            </span>
                        </label>
                    </Notice>
                )}
            </div>
        </DialogFrame>
    );
}
