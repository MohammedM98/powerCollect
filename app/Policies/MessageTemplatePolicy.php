<?php

namespace App\Policies;

use App\Enums\PermissionKey;
use App\Models\MessageTemplate;
use App\Models\User;

/**
 * Saved wordings are shared by the whole company; whoever may send
 * messages may add, change or remove them.
 */
class MessageTemplatePolicy
{
    /**
     * Determine whether the user can view any models.
     */
    public function viewAny(User $user): bool
    {
        return $user->hasPermission(PermissionKey::SendMessages);
    }

    /**
     * Determine whether the user can create models.
     */
    public function create(User $user): bool
    {
        return $this->managesCompanyTemplates($user);
    }

    /**
     * Determine whether the user can update the model.
     */
    public function update(User $user, MessageTemplate $template): bool
    {
        return $this->managesCompanyTemplates($user);
    }

    /**
     * Determine whether the user can delete the model.
     */
    public function delete(User $user, MessageTemplate $template): bool
    {
        return $this->managesCompanyTemplates($user);
    }

    /**
     * Templates are the company's, shared by every branch: written by someone
     * who sends messages and belongs to no branch, never from a branch's staff.
     */
    private function managesCompanyTemplates(User $user): bool
    {
        return $user->hasPermission(PermissionKey::SendMessages) && $user->branch_id === null;
    }
}
