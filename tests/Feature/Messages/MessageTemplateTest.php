<?php

namespace Tests\Feature\Messages;

use App\Enums\MessageKind;
use App\Enums\PermissionKey;
use App\Models\Branch;
use App\Models\MessageTemplate;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

/**
 * Message templates are the company's, shared by every branch: branch
 * staff who send messages use them, and only company staff change them.
 */
class MessageTemplateTest extends TestCase
{
    use RefreshDatabase;

    public function test_branch_staff_who_send_messages_use_the_templates_but_cannot_change_them(): void
    {
        $sender = User::factory()->collector()->for(Branch::factory())->withPermissions([PermissionKey::ViewMessages, PermissionKey::SendMessages])->create();
        $template = MessageTemplate::factory()->create();
        $before = $template->fresh()->getAttributes();
        $count = MessageTemplate::count();

        $this->actingAs($sender)->get(route('messages.create'))
            ->assertInertia(fn (AssertableInertia $page) => $page->has('templates', $count)->where('canManageTemplates', false));
        $this->post(route('message-templates.store'), ['name' => 'تذكير', 'kind' => MessageKind::cases()[0]->value, 'body' => 'نص'])->assertForbidden();
        $this->put(route('message-templates.update', $template), ['name' => 'معدّل', 'kind' => $template->kind->value, 'body' => 'نص جديد'])->assertForbidden();
        $this->delete(route('message-templates.destroy', $template))->assertForbidden();

        $this->assertSame($before, $template->fresh()->getAttributes());
        $this->assertDatabaseCount('message_templates', $count);
    }

    public function test_the_owner_adds_changes_and_deletes_a_template(): void
    {
        $owner = User::factory()->superAdmin()->create();
        $kind = MessageKind::cases()[0]->value;

        $this->actingAs($owner)->get(route('messages.create'))
            ->assertInertia(fn (AssertableInertia $page) => $page->where('canManageTemplates', true));
        $this->post(route('message-templates.store'), ['name' => 'تذكير', 'kind' => $kind, 'body' => 'عزيزي {الاسم}'])->assertSessionHasNoErrors();
        $template = MessageTemplate::query()->where('name', 'تذكير')->sole();
        $this->put(route('message-templates.update', $template), ['name' => 'تذكير الدفع', 'kind' => $kind, 'body' => 'عزيزي {الاسم}، يرجى السداد'])->assertSessionHasNoErrors();
        $this->assertSame(['تذكير الدفع', 'عزيزي {الاسم}، يرجى السداد', $owner->id], [$template->fresh()->name, $template->fresh()->body, $template->created_by]);

        $this->delete(route('message-templates.destroy', $template))->assertSessionHasNoErrors();

        $this->assertModelMissing($template);
    }
}
