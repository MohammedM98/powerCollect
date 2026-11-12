import { useEffect, useMemo, useState } from 'react';
import { dominantColors } from '@/lib/brandPalette';

/** A file chosen for a logo as an address the page can show, released when it changes. */
export function useFileUrl(file) {
    const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

    useEffect(() => () => url && URL.revokeObjectURL(url), [url]);

    return url;
}

/** The colours a logo is drawn in, worked out in the browser once it loads. */
export function useLogoColors(src) {
    const [colors, setColors] = useState([]);

    useEffect(() => {
        if (!src) {
            setColors([]);
            return undefined;
        }

        let cancelled = false;
        const image = new Image();
        image.onload = () => {
            const canvas = document.createElement('canvas');
            const size = 72;
            canvas.width = size;
            canvas.height = size;
            const context = canvas.getContext('2d', { willReadFrequently: true });
            context.drawImage(image, 0, 0, size, size);

            try {
                !cancelled && setColors(dominantColors(context.getImageData(0, 0, size, size).data));
            } catch {
                !cancelled && setColors([]);
            }
        };
        image.src = src;

        return () => {
            cancelled = true;
        };
    }, [src]);

    return colors;
}
