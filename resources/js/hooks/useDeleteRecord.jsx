import { useState } from 'react';
import { router } from '@inertiajs/react';
import ConfirmDialog from '@/Components/ConfirmDialog';
import TextInput from '@/Components/TextInput';

/**
 * Deleting a record from a list, after a confirmation. `requestDelete(url,
 * name, noun?)` asks "delete «name»?"; yes sends DELETE to `url`. The server
 * deletes only what nothing uses any more, and otherwise says what still
 * does. Render `deleteDialog` once on the page. `noun` names the kind of
 * record in the question ("المشترك", "الفرع"…), unless a request names
 * its own. A deletion cannot be undone, so the button waits until the
 * record's name is typed (spaces at the ends aside).
 */
export function useDeleteRecord(noun) {
    const [pending, setPending] = useState(null);
    const [typedName, setTypedName] = useState('');
    const nameTyped = Boolean(pending) && typedName.trim() === String(pending.name).trim();

    function confirm() {
        if (!nameTyped) {
            return;
        }
        router.delete(pending.url, { preserveScroll: true });
        setPending(null);
    }

    const deleteDialog = (
        <ConfirmDialog
            show={Boolean(pending)}
            onConfirm={confirm}
            onCancel={() => setPending(null)}
            title={`حذف ${pending?.noun ?? noun}؟`}
            message={pending && `سيُحذف «${pending.name}» نهائيًا ولا يمكن التراجع عن ذلك.`}
            confirmLabel="نعم، احذف"
            cancelLabel="إلغاء"
            icon="trash"
            tone="danger"
            confirmDisabled={!nameTyped}
        >
            {pending && (
                <div className="mt-4 grid gap-2">
                    <label htmlFor="delete-record-name" className="text-sm text-(--gl-muted)">
                        اكتب <b className="text-(--gl-bad)">{pending.name}</b> للتأكيد
                    </label>
                    <TextInput
                        id="delete-record-name"
                        autoComplete="off"
                        value={typedName}
                        onChange={(event) => setTypedName(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                                event.preventDefault();
                                confirm();
                            }
                        }}
                        className="block w-full"
                    />
                </div>
            )}
        </ConfirmDialog>
    );

    function requestDelete(url, name, ownNoun = null) {
        setTypedName('');
        setPending({ url, name, noun: ownNoun });
    }

    return { requestDelete, deleteDialog };
}
