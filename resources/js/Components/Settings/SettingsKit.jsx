import { Alert, Button, Card, Label, ListBox, Select } from '@heroui/react';
import FormSettingRow from '@/Components/Form/SettingRow';
import Icon from '@/Components/UI/Icon';
import KitSwitch from '@/Components/UI/Switch';

/**
 * The settings pages' kit, built from HeroUI in the MA look: a section is a
 * glass HeroUI Card headed by its icon on a tinted tile (`tone`: brand, pay,
 * owe, disc, clr, split or warn), its title and a line on what it holds,
 * with an optional `aside` (a chip, a key) at the head's end.
 */
export function SettingsSection({ icon, tone = 'brand', title, description = null, aside = null, footer = null, id, children }) {
    const titleId = id ? `${id}-title` : undefined;

    return (
        <Card className="gl-set-card" data-tone={tone} aria-labelledby={titleId} id={id}>
            <Card.Header className="gl-set-head">
                <span className="gl-set-ico" aria-hidden="true">
                    <Icon name={icon} />
                </span>
                <div className="min-w-0 flex-1">
                    <Card.Title id={titleId} className="gl-set-title">{title}</Card.Title>
                    {description && <Card.Description className="gl-set-desc">{description}</Card.Description>}
                </div>
                {aside && <div className="gl-set-aside">{aside}</div>}
            </Card.Header>
            <Card.Content className="gl-set-body">{children}</Card.Content>
            {footer && <Card.Footer className="gl-set-foot">{footer}</Card.Footer>}
        </Card>
    );
}

/** One setting: its name and a line on what it does on one side, its control on the other. */
export function SettingRow({ label, hint = null, htmlFor, children }) {
    return (
        <div className="gl-set-row">
            <div className="gl-set-row-text">
                {htmlFor ? <label htmlFor={htmlFor} className="gl-set-label">{label}</label> : <span className="gl-set-label">{label}</span>}
                {hint && <p className="gl-set-hint">{hint}</p>}
            </div>
            <div className="gl-set-row-control">{children}</div>
        </div>
    );
}

/**
 * HeroUI's Select for a setting: `options` as [{ value, label }], `value`
 * matched as text so numbers and strings both work, `onChange` with the
 * option's own value.
 */
export function SettingsSelect({ label, value, options, onChange, name, isDisabled = false, className = '' }) {
    const keyOf = (option) => String(option.value);

    return (
        <Select
            aria-label={label}
            name={name}
            className={`gl-set-select ${className}`}
            selectedKey={value === null || value === undefined ? null : String(value)}
            onSelectionChange={(key) => {
                const chosen = options.find((option) => keyOf(option) === String(key));
                if (chosen) {
                    onChange(chosen.value);
                }
            }}
            isDisabled={isDisabled}
        >
            <Label className="sr-only">{label}</Label>
            <Select.Trigger className="gl-set-select-trigger">
                <Select.Value />
                <Select.Indicator />
            </Select.Trigger>
            <Select.Popover className="gl-set-select-pop">
                <ListBox>
                    {options.map((option) => (
                        <ListBox.Item key={keyOf(option)} id={keyOf(option)} textValue={option.label}>
                            {option.label}
                            <ListBox.ItemIndicator />
                        </ListBox.Item>
                    ))}
                </ListBox>
            </Select.Popover>
        </Select>
    );
}

/** A section's save key: HeroUI's Button, raised dark, its label while saving. */
export function SaveButton({ processing = false, isDisabled = false, children = 'حفظ', processingLabel = 'جارٍ الحفظ…', form }) {
    return (
        <Button type="submit" form={form} isDisabled={isDisabled || processing} className="gl-set-save">
            <Icon name="check" className="h-4 w-4" />
            {processing ? processingLabel : children}
        </Button>
    );
}

/** The flash a save leaves, as HeroUI's Alert in the payment green. */
export function SettingsStatus({ message }) {
    if (!message) {
        return null;
    }

    return (
        <Alert status="success" className="gl-set-status" role="status">
            <Alert.Indicator />
            <Alert.Content>
                <Alert.Title>{message}</Alert.Title>
            </Alert.Content>
        </Alert>
    );
}

/** A table's heading in a settings page: the section's icon tile, title and line, and its action (an add key) at the end. */
export function SettingsHeading({ id, icon, tone = 'brand', title, description = null, action = null }) {
    return (
        <div className="gl-set-heading" data-tone={tone}>
            <span className="gl-set-ico" aria-hidden="true">
                <Icon name={icon} />
            </span>
            <div className="min-w-0 flex-1">
                <h2 id={id} className="gl-set-title">{title}</h2>
                {description && <p className="gl-set-desc">{description}</p>}
            </div>
            {action}
        </div>
    );
}

/** An on/off setting: the shared setting row with the kit's switch at its end, `hint` as the line under its name. */
export function SettingSwitch({ label, isSelected, onChange, isDisabled = false, hint = null }) {
    return (
        <FormSettingRow title={label} description={hint}>
            <KitSwitch checked={isSelected} onChange={onChange} disabled={isDisabled} ariaLabel={label} />
        </FormSettingRow>
    );
}
