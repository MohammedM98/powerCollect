import { transactionNoun } from '@/lib/accountStatement';
import { formatDate } from '@/lib/format';

export function actionItem(entry, action) {
    const noun = transactionNoun(entry);

    return {
        edit: {
            label: 'تعديل المبلغ',
            description: 'تعديل مبلغ آخر حركة مؤهلة وإعادة احتساب رصيدها',
            icon: 'pencil',
            tone: 'amber',
        },
        edit_metadata: {
            label: entry.splitPayment ? 'تعديل الحوالة المقسّمة' : 'تعديل بيانات الدفعة',
            description: entry.splitPayment ? 'بيانات الحوالة لجميع المشتركين — المبلغ والحصص ثابتة' : 'البنك والمرجع والمرسل والملاحظات — الرصيد لا يتغيّر',
            icon: 'pencil',
            tone: 'blue',
        },
        delete: {
            label: entry.type === 'payment' ? 'إرجاع الدفعة' : `إلغاء ${noun}`,
            description: 'عكس الأثر المالي بقيد مرتبط مع حفظ الحركة الأصلية والسبب',
            icon: 'trash',
            tone: 'red',
        },
        cancel: {
            label: `إلغاء ${noun}`,
            description: `إضافة حركة إلغاء مرتبطة بـ${noun} في نهاية السجل`,
            icon: 'close',
            tone: 'brand',
        },
        refund: {
            label: 'إرجاع الدفعة',
            description: 'إرجاع كامل الدفعة بحركة مرتبطة، ثم تسجيل الدفعة الصحيحة إن لزم',
            icon: 'repeat',
            tone: 'brand',
        },
    }[action];
}

export function lineActionsMenu(entry, onAction) {
    const items = (entry.available_actions ?? []).map((action) => ({
        ...actionItem(entry, action),
        onSelect: () => onAction(action, entry),
    }));
    const groups = [
        ...(items.length ? [{ label: 'إجراءات الحركة', items }] : []),
        ...(entry.reading
            ? [
                  {
                      label: 'القراءة الأسبوعية',
                      items: [
                          {
                              label: 'تصحيح القراءة',
                              description: 'أدخل القراءة الصحيحة: تُلغى الحركة بقيد عكسي، وتعود القراءة للاعتماد ثم تُحمَّل من جديد',
                              icon: 'bolt',
                              tone: 'amber',
                              disabled: !entry.reading.canCorrect,
                              hint: entry.reading.correctUnavailableReason ?? undefined,
                              onSelect: () => onAction('correct_reading', entry),
                          },
                      ],
                  },
              ]
            : []),
        ...(entry.receiptUrl
            ? [
                  {
                      label: 'طباعة',
                      items: [
                          {
                              label: 'طباعة سند القبض',
                              description: 'يُفتح السند في نافذة جديدة جاهزًا للطباعة',
                              icon: 'printer',
                              tone: 'violet',
                              onSelect: () => window.open(entry.receiptUrl, '_blank'),
                          },
                      ],
                  },
              ]
            : []),
    ];

    return groups.length
        ? {
              title: entry.typeLabel,
              description: [entry.description, entry.details].filter(Boolean).join('\n'),
              subtitle: formatDate(entry.date),
              width: 410,
              colorful: true,
              groups,
          }
        : null;
}
