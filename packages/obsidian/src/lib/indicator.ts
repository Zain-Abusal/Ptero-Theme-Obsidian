import { useLayoutEffect, useRef } from 'react';

/**
 * Moves one highlight to the active link of a nav, so switching pages slides it rather than snapping.
 * Measures with offsetTop/offsetHeight (no layout thrash beyond one read per change) and writes CSS
 * variables only, so the motion itself runs on the compositor.
 */
export function useActiveIndicator<T extends HTMLElement>(deps: readonly unknown[]) {
    const ref = useRef<T>(null);

    useLayoutEffect(() => {
        const root = ref.current;
        if (!root) return;

        const place = () => {
            const active = root.querySelector<HTMLElement>('.obs-nav-link[data-status="active"]');
            if (!active || active.offsetParent === null) {
                root.style.setProperty('--obs-ind-o', '0');
                return;
            }
            let top = 0;
            for (let el: HTMLElement | null = active; el && el !== root; el = el.offsetParent as HTMLElement | null) top += el.offsetTop;
            root.style.setProperty('--obs-ind-y', `${top}px`);
            root.style.setProperty('--obs-ind-h', `${active.offsetHeight}px`);
            root.style.setProperty('--obs-ind-o', '1');
        };

        place();
        // Links render after their bundles and groups collapse, so watch for both.
        const observer = new MutationObserver(place);
        observer.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-status'] });
        const resize = new ResizeObserver(place);
        resize.observe(root);

        return () => {
            observer.disconnect();
            resize.disconnect();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);

    return ref;
}
