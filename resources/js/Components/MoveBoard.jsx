import { useEffect, useRef, useState } from 'react';
import { motionOff } from '@/Components/CountUp';

/**
 * Items laid out in lanes, the prototype's board (glass.css `gl-board`): an
 * item is dragged from one lane to another, or, from the keyboard, picked up
 * with Space or Enter, carried with the arrow keys and put down with Space
 * or Enter again (Escape puts it back). The board never moves anything
 * itself: a drop calls `onMove(item, lane)`, and the page asks for
 * confirmation before saving it, so what the board shows is always what the
 * server holds.
 *
 * `lanes` are `{ key, label, note?, color? }`; `laneOf(item)` and
 * `itemKey(item)` place and name each item, `itemLabel(item)` is how it is
 * read aloud, and `renderCard(item)` draws it. `canMove` false shows the
 * board without dragging. A lane shows its first `limit` items with a
 * button for the rest, so a branch of many boxes keeps a short board.
 *
 * @param {{ lanes: Array<{ key: string, label: string, note?: string, color?: string }>, items: Array<object>, laneOf: (item: object) => string, itemKey: (item: object) => string|number, itemLabel: (item: object) => string, renderCard: (item: object) => import('react').ReactNode, onMove: (item: object, lane: object) => void, canMove?: boolean, busy?: boolean, limit?: number, label: string }} props
 */
export default function MoveBoard({ lanes, items, laneOf, itemKey, itemLabel, renderCard, onMove, canMove = true, busy = false, limit = 40, label }) {
    const boardRef = useRef(null);
    const [hotLane, setHotLane] = useState(null);
    const [held, setHeld] = useState(null);
    const [expanded, setExpanded] = useState(() => new Set());
    const [announcement, setAnnouncement] = useState('');
    const [landing, setLanding] = useState(null);
    const movable = canMove && !busy;

    useEffect(() => {
        if (landing === null) {
            return undefined;
        }

        const timer = setTimeout(() => setLanding(null), 700);

        return () => clearTimeout(timer);
    }, [landing]);

    function laneByKey(key) {
        return lanes.find((lane) => lane.key === key);
    }

    function drop(item, laneKey) {
        const lane = laneByKey(laneKey);

        if (!lane || laneKey === laneOf(item)) {
            return;
        }

        setLanding(itemKey(item));
        onMove(item, lane);
    }

    function startPointerDrag(event, item) {
        if (!movable || event.button > 0) {
            return;
        }

        const card = event.currentTarget;
        const startX = event.clientX;
        const startY = event.clientY;
        const box = card.getBoundingClientRect();
        let dragging = false;
        let ghost = null;
        let over = null;

        card.setPointerCapture(event.pointerId);

        function follow(moveEvent) {
            const dx = moveEvent.clientX - startX;
            const dy = moveEvent.clientY - startY;

            if (!dragging) {
                if (Math.hypot(dx, dy) < 6) {
                    return;
                }

                dragging = true;
                ghost = card.cloneNode(true);
                ghost.classList.add('is-ghost');
                ghost.removeAttribute('id');
                Object.assign(ghost.style, { left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px` });
                document.body.appendChild(ghost);
                card.classList.add('is-dragging');

                if (!motionOff()) {
                    ghost.animate([{ transform: 'scale(1) rotate(0)' }, { transform: 'scale(1.04) rotate(-2deg)' }], {
                        duration: 260,
                        easing: 'cubic-bezier(.2,1.6,.4,1)',
                        fill: 'forwards',
                    });
                }
            }

            ghost.style.translate = `${dx}px ${dy}px`;
            const under = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY)?.closest('[data-lane]');
            const laneKey = under && boardRef.current?.contains(under) ? under.dataset.lane : null;

            if (laneKey !== over) {
                over = laneKey;
                setHotLane(laneKey);
            }
        }

        function finish() {
            card.removeEventListener('pointermove', follow);
            card.removeEventListener('pointerup', finish);
            card.removeEventListener('pointercancel', finish);
            setHotLane(null);

            if (!dragging) {
                return;
            }

            card.classList.remove('is-dragging');

            if (over && over !== laneOf(item)) {
                ghost.remove();
                drop(item, over);

                return;
            }

            if (motionOff()) {
                ghost.remove();
            } else {
                ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200 }).onfinish = () => ghost.remove();
            }
        }

        card.addEventListener('pointermove', follow);
        card.addEventListener('pointerup', finish);
        card.addEventListener('pointercancel', finish);
    }

    function keyDown(event, item) {
        if (!movable) {
            return;
        }

        const key = itemKey(item);
        const holding = held?.key === key;

        if (event.key === ' ' || event.key === 'Enter') {
            event.preventDefault();

            if (!holding) {
                setHeld({ key, lane: laneOf(item) });
                setHotLane(laneOf(item));
                setAnnouncement(`حُمل ${itemLabel(item)}. استخدم الأسهم لاختيار العمود، ثم Enter للنقل أو Escape للإلغاء.`);

                return;
            }

            setHeld(null);
            setHotLane(null);

            if (held.lane === laneOf(item)) {
                setAnnouncement(`أُعيد ${itemLabel(item)} إلى مكانه.`);

                return;
            }

            drop(item, held.lane);

            return;
        }

        if (holding && event.key === 'Escape') {
            event.preventDefault();
            setHeld(null);
            setHotLane(null);
            setAnnouncement(`أُلغي نقل ${itemLabel(item)}.`);

            return;
        }

        if (holding && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
            event.preventDefault();
            const rtl = getComputedStyle(event.currentTarget).direction === 'rtl';
            const forward = (event.key === 'ArrowLeft') === rtl;
            const index = lanes.findIndex((lane) => lane.key === held.lane);
            const next = lanes[(index + (forward ? 1 : -1) + lanes.length) % lanes.length];
            setHeld({ key, lane: next.key });
            setHotLane(next.key);
            setAnnouncement(`فوق ${next.label}.`);
        }
    }

    function toggleLane(key) {
        setExpanded((current) => {
            const next = new Set(current);
            next.has(key) ? next.delete(key) : next.add(key);

            return next;
        });
    }

    return (
        <div className="gl-board-w" aria-busy={busy}>
            <p className="sr-only" id="move-board-help">
                {movable
                    ? 'اسحب البطاقة إلى عمود آخر، أو اضغط Enter عليها ثم الأسهم لاختيار العمود وEnter للنقل. يُطلب تأكيد قبل الحفظ.'
                    : 'عرض فقط.'}
            </p>
            <p className="sr-only" role="status" aria-live="polite">
                {announcement}
            </p>
            <div ref={boardRef} className="gl-board" role="list" aria-label={label} style={{ '--lanes': lanes.length }}>
                {lanes.map((lane, index) => {
                    const laneItems = items.filter((item) => laneOf(item) === lane.key);
                    const shown = expanded.has(lane.key) ? laneItems : laneItems.slice(0, limit);

                    return (
                        <section
                            key={lane.key}
                            role="listitem"
                            data-lane={lane.key}
                            aria-label={`${lane.label}: ${laneItems.length}`}
                            className={`gl-glass gl-lane gl-rise ${hotLane === lane.key ? 'is-hot' : ''}`}
                            style={{ '--i': Math.min(index, 11) }}
                        >
                            <h3>
                                <i aria-hidden="true" style={{ '--gl-c': lane.color ?? 'rgb(var(--gl-brand))' }} />
                                <span className="min-w-0 flex-1 truncate" dir="auto">
                                    {lane.label}
                                </span>
                                <em className="gl-num">{laneItems.length.toLocaleString('en')}</em>
                            </h3>
                            {lane.note && <p className="gl-note">{lane.note}</p>}
                            {shown.map((item) => {
                                const key = itemKey(item);

                                return (
                                    <article
                                        key={key}
                                        tabIndex={0}
                                        aria-roledescription="بطاقة قابلة للنقل"
                                        aria-describedby="move-board-help"
                                        aria-pressed={movable ? held?.key === key : undefined}
                                        aria-label={itemLabel(item)}
                                        className={`gl-mb ${landing === key ? 'is-landing' : ''} ${held?.key === key ? 'is-held' : ''} ${movable ? '' : 'is-static'}`}
                                        onPointerDown={(event) => startPointerDrag(event, item)}
                                        onKeyDown={(event) => keyDown(event, item)}
                                        onBlur={() => held?.key === key && (setHeld(null), setHotLane(null))}
                                    >
                                        {renderCard(item)}
                                    </article>
                                );
                            })}
                            {laneItems.length > limit && (
                                <button
                                    type="button"
                                    className="gl-btn gl-ghost gl-sm"
                                    aria-expanded={expanded.has(lane.key)}
                                    onClick={() => toggleLane(lane.key)}
                                >
                                    {expanded.has(lane.key) ? 'عرض أقل' : `عرض ${(laneItems.length - limit).toLocaleString('en')} أخرى`}
                                </button>
                            )}
                            {laneItems.length === 0 && <div className="gl-empty text-sm">{movable ? 'أفلت هنا' : 'لا شيء هنا'}</div>}
                        </section>
                    );
                })}
            </div>
        </div>
    );
}
