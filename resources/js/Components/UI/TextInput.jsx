import { Input } from '@heroui/react';

/**
 * A text field: HeroUI's Input, taking a native input's props (value,
 * onChange with its event, ref…). Corners, border and the focus ring come
 * from the shared field styles in app.css.
 */
export default function TextInput({ className = '', ...props }) {
    return <Input {...props} className={`block ${className}`} />;
}
