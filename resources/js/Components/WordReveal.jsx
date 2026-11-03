import { Fragment } from 'react';

/**
 * A page title that rises in a word at a time, 70ms apart: whole words,
 * since splitting Arabic into letters breaks their joins. Text inside
 * other elements (a name in the brand colour) is passed as `children`
 * after the plain words.
 */
export default function WordReveal({ text, children = null }) {
    const words = String(text ?? '').split(' ').filter(Boolean);

    return (
        <>
            {words.map((word, index) => (
                <Fragment key={index}>
                    <span className="gl-word" style={{ '--w': index }}>{word}</span>{' '}
                </Fragment>
            ))}
            {children && <span className="gl-word" style={{ '--w': words.length }}>{children}</span>}
        </>
    );
}
