import { useEffect, useId, useState } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import { Button, Card, Chip, FieldError, Input, Label, Radio, RadioGroup, TextField } from '@heroui/react';
import { SaveButton } from '@/Components/Settings/SettingsKit';
import SettingsLayout from '@/Layouts/SettingsLayout';
import Icon from '@/Components/Icon';
import Modal from '@/Components/Modal';
import { printUrl } from '@/lib/print';
import { PAPER_SIZES } from '@/lib/printLayout';
import { timeAgo } from '@/lib/format';
import PageHeader from '@/Components/PageHeader';
import { AddKey, ConfirmDialog } from '@/Components/UI';

/** Open the print designer on a list, with one of its templates (an id) or a new one. */
function openDesigner(page, template) {
    window.open(`${printUrl(page.label, page.path)}&print_template=${template}`, '_blank');
}

/** One of a template's keys: HeroUI's icon-only Button, its name for screen readers and as a tooltip, in its tone. */
function TemplateKey({ icon, label, onPress, tone = 'ink' }) {
    return (
        <Button isIconOnly size="sm" aria-label={label} onPress={onPress} className="gl-pt-key" data-tone={tone}>
            <Icon name={icon} className="h-4 w-4" />
            <span className="gl-pt-tip" aria-hidden="true">{label}</span>
        </Button>
    );
}

/** A settings window's head: its icon on the MA tile, its title and a line under it. */
function WindowHead({ id, icon, title, description = null }) {
    return (
        <div className="gl-win-head">
            <span className="gl-set-ico" aria-hidden="true"><Icon name={icon} /></span>
            <div className="min-w-0">
                <h2 id={id} className="gl-set-title">{title}</h2>
                {description && <p className="gl-set-desc">{description}</p>}
            </div>
        </div>
    );
}

function RenameModal({ template, onClose }) {
    const id = useId();
    const { errors } = usePage().props;
    const [name, setName] = useState(template.name);
    const [saving, setSaving] = useState(false);

    function save(event) {
        event.preventDefault();
        setSaving(true);
        router.put(`/print-templates/${template.id}`, { name: name.trim() }, { preserveScroll: true, onSuccess: onClose, onFinish: () => setSaving(false) });
    }

    return (
        <Modal show onClose={onClose} maxWidth="md">
            <form onSubmit={save} role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} className="gl-win">
                <WindowHead id={`${id}-title`} icon="tag" title="إعادة تسمية القالب" description={`الاسم الحالي: ${template.name}`} />
                <div className="gl-win-body">
                    <TextField isRequired isInvalid={Boolean(errors.name)} value={name} onChange={setName} className="gl-set-field" autoFocus>
                        <Label>الاسم الجديد</Label>
                        <Input id={`${id}-name`} />
                        <FieldError>{errors.name}</FieldError>
                    </TextField>
                </div>
                <div className="gl-win-foot">
                    <Button type="button" onPress={onClose} className="gl-win-cancel">إلغاء</Button>
                    <SaveButton processing={saving} isDisabled={name.trim() === ''}>حفظ الاسم</SaveButton>
                </div>
            </form>
        </Modal>
    );
}

function NewTemplateModal({ pages, onClose }) {
    const id = useId();
    const [path, setPath] = useState(pages[0]?.path ?? '');

    return (
        <Modal show onClose={onClose} maxWidth="2xl">
            <div role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} className="gl-win">
                <WindowHead id={`${id}-title`} icon="printer" title="قالب طباعة جديد" description="اختر القائمة، فيُفتح مصمم الطباعة على بياناتها. صمّم كما تريد ثم احفظه كقالب." />
                <div className="gl-win-body">
                    <RadioGroup aria-label="القائمة" value={path} onChange={setPath} className="gl-pt-pick">
                        {pages.map((page) => (
                            <Radio key={page.path} value={page.path} className="gl-pt-pick-item">
                                <Radio.Content>
                                    <span className="gl-pt-pick-ico" aria-hidden="true"><Icon name={page.icon} /></span>
                                    <span className="gl-pt-pick-name">{page.label}</span>
                                    <span className="gl-pt-pick-count">{page.templates.length ? `${page.templates.length} قالب` : 'جديد'}</span>
                                    <Radio.Control className="sr-only"><Radio.Indicator /></Radio.Control>
                                </Radio.Content>
                            </Radio>
                        ))}
                    </RadioGroup>
                </div>
                <div className="gl-win-foot">
                    <Button type="button" onPress={onClose} className="gl-win-cancel">إلغاء</Button>
                    <Button
                        type="button"
                        className="gl-set-save"
                        onPress={() => {
                            openDesigner(pages.find((page) => page.path === path), 'new');
                            onClose();
                        }}
                    >
                        <Icon name="external" className="h-4 w-4" />
                        فتح المصمم
                    </Button>
                </div>
            </div>
        </Modal>
    );
}

/** A template's paper, orientation and number of printed columns, in words. */
function templateSummary(template) {
    const paper = PAPER_SIZES[template.paper]?.label ?? template.paper;

    return `${paper} ${template.orientation === 'landscape' ? 'عرضي' : 'طولي'}، ${template.columnCount} أعمدة`;
}

/**
 * Every print template of the company in one place, under the list each
 * one prints: open one in the print designer to change it (on the list's
 * real rows), copy, rename, delete, or make it the list's default — the
 * design its print button starts from.
 */
export default function PrintTemplates({ pages }) {
    const [creating, setCreating] = useState(false);
    const [renaming, setRenaming] = useState(null);
    const [deleting, setDeleting] = useState(null);
    const total = pages.reduce((count, page) => count + page.templates.length, 0);

    // A template saved in the designer's tab shows here on coming back.
    useEffect(() => {
        function refresh() {
            if (document.visibilityState === 'visible') {
                router.reload({ only: ['pages'] });
            }
        }

        document.addEventListener('visibilitychange', refresh);
        return () => document.removeEventListener('visibilitychange', refresh);
    }, []);

    function update(template, data) {
        router.put(`/print-templates/${template.id}`, data, { preserveScroll: true });
    }

    return (
        <SettingsLayout
            header={
                <PageHeader
                    title="قوالب الطباعة"
                    info="صمّم طريقة طباعة كل قائمة، واجعل أحد قوالبها الافتراضي الذي يبدأ منه زر الطباعة."
                    meta={`${total.toLocaleString('en')} قالب محفوظ لكل الشركة`}
                    actions={<AddKey onClick={() => setCreating(true)}>قالب جديد</AddKey>}
                />
            }
        >
            <Head title="قوالب الطباعة" />

            <div className="gl-pt-grid">
                {pages.map((page) => (
                    <Card key={page.path} className="gl-set-card gl-pt-card" aria-labelledby={`list-${page.path}`} data-empty={page.templates.length === 0 || undefined}>
                        <Card.Header className="gl-set-head gl-pt-head">
                            <span className="gl-set-ico" aria-hidden="true">
                                <Icon name={page.icon} />
                            </span>
                            <div className="min-w-0 flex-1">
                                <Card.Title id={`list-${page.path}`} className="gl-set-title">{page.label}</Card.Title>
                                <Card.Description className="gl-set-desc">{page.templates.length === 0 ? 'لا توجد قوالب بعد' : `${page.templates.length} قالب`}</Card.Description>
                            </div>
                            <Button size="sm" className="gl-pt-add" aria-label={`قالب طباعة جديد لـ«${page.label}»`} onPress={() => openDesigner(page, 'new')}>
                                <Icon name="plus" className="h-4 w-4" />
                                قالب جديد لها
                            </Button>
                        </Card.Header>

                        {page.templates.length > 0 && (
                            <Card.Content className="gl-pt-list">
                                {page.templates.map((template) => (
                                    <div key={template.id} className="gl-pt-item" data-default={template.isDefault || undefined}>
                                        <div className="min-w-0 flex-1">
                                            <div className="gl-pt-name">
                                                <b>{template.name}</b>
                                                {template.isDefault && (
                                                    <Chip size="sm" variant="soft" color="success" className="gl-set-chip">
                                                        <Icon name="check" className="h-3 w-3" strokeWidth={2.5} />
                                                        الافتراضي
                                                    </Chip>
                                                )}
                                            </div>
                                            <p className="gl-pt-meta">
                                                {templateSummary(template)}، {timeAgo(template.updatedAt)}{template.updatedBy && `، ${template.updatedBy}`}
                                            </p>
                                        </div>
                                        <div className="gl-pt-keys">
                                            <TemplateKey icon="pencil" tone="brand" label={`فتح «${template.name}» في مصمم الطباعة`} onPress={() => openDesigner(page, template.id)} />
                                            <TemplateKey
                                                icon={template.isDefault ? 'close' : 'check'}
                                                tone={template.isDefault ? 'muted' : 'pay'}
                                                label={template.isDefault ? `إلغاء كون «${template.name}» الافتراضي` : `جعل «${template.name}» الافتراضي لـ«${page.label}»`}
                                                onPress={() => update(template, { is_default: !template.isDefault })}
                                            />
                                            <TemplateKey icon="document-plus" label={`نسخ «${template.name}»`} onPress={() => router.post(`/print-templates/${template.id}/duplicate`, {}, { preserveScroll: true })} />
                                            <TemplateKey icon="tag" label={`إعادة تسمية «${template.name}»`} onPress={() => setRenaming(template)} />
                                            <TemplateKey icon="trash" tone="owe" label={`حذف «${template.name}»`} onPress={() => setDeleting(template)} />
                                        </div>
                                    </div>
                                ))}
                            </Card.Content>
                        )}
                    </Card>
                ))}
            </div>

            {creating && <NewTemplateModal pages={pages} onClose={() => setCreating(false)} />}
            {renaming && <RenameModal key={renaming.id} template={renaming} onClose={() => setRenaming(null)} />}
            <ConfirmDialog
                show={deleting !== null}
                onConfirm={() => {
                    router.delete(`/print-templates/${deleting.id}`, { preserveScroll: true });
                    setDeleting(null);
                }}
                onCancel={() => setDeleting(null)}
                title="حذف القالب؟"
                message={`سيُحذف «${deleting?.name ?? ''}» من قوالب الشركة لكل المستخدمين.`}
                confirmLabel="نعم، احذف"
                icon="trash"
                tone="danger"
            />
        </SettingsLayout>
    );
}
