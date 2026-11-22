import { TextArea as HeroTextArea } from '@heroui/react';

/**
 * A text field of several lines: HeroUI's TextArea, taking a native
 * textarea's props (value, onChange with its event, rows, ref…). Corners,
 * border and the focus ring come from the shared field styles.
 */
export default function TextArea({ className = '', ...props }) {
    return <HeroTextArea {...props} className={`block ${className}`} />;
}
