/**
 * A setting on its own tile: its name, a line saying what it means, and
 * its control (usually a Switch) at the end, as in a phone's settings.
 */
export default function SettingRow({ title, description = null, children }) {
    return (
        <div className="gl-setting">
            <div className="gl-setting-text">
                <b>{title}</b>
                {description && <small>{description}</small>}
            </div>
            {children}
        </div>
    );
}
