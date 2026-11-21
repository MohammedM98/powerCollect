import { AuditWorkSummary } from './AuditAccessCard';
import { PermissionSummary, RiskGauge } from './PermissionInsights';

/** The «ماذا يستطيع؟» tab: what the employee can do in plain words, beside how risky it is and their audit work. */
export default function PermissionSummaryView({
    employee,
    sections,
    selected,
    template,
    scopedToOwnBranch,
    firstName,
    auditOptions,
    auditEnabled,
    auditValue,
}) {
    return (
        <div
            id="permission-view-summary"
            role="tabpanel"
            aria-labelledby="permission-tab-summary"
            className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]"
        >
            <PermissionSummary
                employee={employee}
                sections={sections}
                selected={selected}
                template={template}
                scopedToOwnBranch={scopedToOwnBranch}
            />
            <div className="space-y-4">
                <div className="pm-card flex flex-col items-center gap-2 p-4 text-center">
                    <h4 className="font-bold text-gray-900">مستوى الخطورة</h4>
                    <RiskGauge sections={sections} selected={selected} large />
                    <p className="text-[13.5px] leading-6 text-gray-500">
                        يزيد مع الصلاحيات التي تحرّك المال أو تغيّر الخدمة. اسحب ما لا يحتاجه {firstName} لعمله.
                    </p>
                </div>
                {auditOptions && auditEnabled && (
                    <AuditWorkSummary employee={employee} options={auditOptions} value={auditValue} enabled={auditEnabled} />
                )}
            </div>
        </div>
    );
}
