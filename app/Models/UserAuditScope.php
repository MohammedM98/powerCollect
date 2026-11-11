<?php

namespace App\Models;

use Database\Factories\UserAuditScopeFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * What a financial auditor may audit: every branch or only the selected
 * ones (user_audit_branches), and which audit actions. A user without a
 * row audits everything (User::auditSettings()).
 */
#[Fillable(['user_id', 'scope', 'actions'])]
class UserAuditScope extends Model
{
    /** @use HasFactory<UserAuditScopeFactory> */
    use HasFactory;

    protected function casts(): array
    {
        return ['actions' => 'array'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
