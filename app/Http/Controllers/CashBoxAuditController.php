<?php

namespace App\Http\Controllers;

use App\Http\Requests\ApproveCashBoxAuditRequest;
use App\Models\CashBox;
use App\Support\BankTransferAuditing;
use Illuminate\Http\RedirectResponse;

class CashBoxAuditController extends Controller
{
    public function store(ApproveCashBoxAuditRequest $request, CashBox $cashBox, BankTransferAuditing $auditing): RedirectResponse
    {
        $auditing->complete($cashBox, $request->user());

        return back()->with('status', 'تم اعتماد الصندوق وتثبيت نتيجة تدقيقه.');
    }
}
