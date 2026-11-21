import { Card, Chip } from '@heroui/react';
import { Link, usePage } from '@inertiajs/react';
import Icon from '@/Components/Icon';
import FieldLayout from '@/Layouts/FieldLayout';
import { formatDayLabel } from '@/lib/format';

/**
 * The field app's home, the same page for every field worker: a greeting
 * card with who and where they are, then their tasks in sections. The
 * server sends only the tasks the user's permissions open
 * (App\Support\Field\FieldTasks), so granting a permission adds its tile.
 */
export default function FieldHome({ greeting, today, sections }) {
    const { auth } = usePage().props;
    const user = auth.user;
    const firstName = (user.name ?? '').trim().split(/\s+/)[0];

    return (
        <FieldLayout title="تطبيق الميدان">
            <Card className="fa-hero">
                <Card.Header className="fa-hero-head">
                    <span className="fa-hero-date">
                        <Icon name="calendar" className="h-4 w-4" />
                        {formatDayLabel(today)}
                    </span>
                    <Card.Title className="fa-hero-title">
                        {greeting}، {firstName}
                    </Card.Title>
                    <Card.Description className="fa-hero-text">
                        {sections.length > 0 ? 'اختر المهمة التي تريد البدء بها.' : 'لا توجد مهام مخصّصة لك بعد.'}
                    </Card.Description>
                </Card.Header>
                <Card.Content className="fa-hero-chips">
                    <Chip size="sm" className="fa-hero-chip">
                        <Icon name="badge" className="h-3.5 w-3.5" />
                        {user.roleLabel}
                    </Chip>
                    {user.branchName && (
                        <Chip size="sm" className="fa-hero-chip">
                            <Icon name="pin" className="h-3.5 w-3.5" />
                            {user.branchName}
                        </Chip>
                    )}
                </Card.Content>
            </Card>

            {sections.length === 0 ? (
                <Card className="fa-empty">
                    <span className="fa-tile-icon" data-tone="warn">
                        <Icon name="lock" className="h-6 w-6" />
                    </span>
                    <Card.Title>لم تُمنح أي مهمة بعد</Card.Title>
                    <Card.Description>تظهر هنا المهام التي يمنحك إياها مدير الفرع أو مدير النظام من صفحة الصلاحيات، مثل إدخال القراءات أو تسجيل الدفعات.</Card.Description>
                </Card>
            ) : (
                sections.map((section) => (
                    <section key={section.key} className="fa-section" aria-labelledby={`fa-section-${section.key}`}>
                        <h2 id={`fa-section-${section.key}`} className="fa-section-title">
                            {section.title}
                        </h2>
                        <div className="fa-grid">
                            {section.tasks.map((task) => (
                                <TaskTile key={task.key} task={task} />
                            ))}
                        </div>
                    </section>
                ))
            )}
        </FieldLayout>
    );
}

/** One task: its tone-coloured icon, name and what it is for; opens the task. */
function TaskTile({ task }) {
    return (
        <Link href={task.href} className="fa-tile" data-task={task.key}>
            <Card className="fa-tile-card">
                <span className="fa-tile-icon" data-tone={task.tone}>
                    <Icon name={task.icon} className="h-6 w-6" />
                </span>
                <span className="fa-tile-text">
                    <Card.Title className="fa-tile-title">{task.title}</Card.Title>
                    <Card.Description className="fa-tile-desc">{task.description}</Card.Description>
                </span>
                <Icon name="chevron-left" className="fa-tile-go h-4 w-4" />
            </Card>
        </Link>
    );
}
