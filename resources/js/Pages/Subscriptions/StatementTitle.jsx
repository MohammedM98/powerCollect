/**
 * An account statement's title, the same in its window and on its page: a
 * small "كشف حساب" above the subscriber's name, which is always the largest
 * thing on the statement. `id` names the dialog or page by it; `children`
 * sit beside the name (the status, a standing discount).
 */
export default function StatementTitle({ id, name, as: Heading = 'h2', children = null }) {
    return (
        <div className="gl-statement-title">
            <span className="gl-statement-kicker">كشف حساب</span>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <Heading id={id} className="gl-statement-name" aria-label={`كشف حساب ${name}`}>
                    {name}
                </Heading>
                {children}
            </div>
        </div>
    );
}
