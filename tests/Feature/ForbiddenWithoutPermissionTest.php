<?php

namespace Tests\Feature;

use App\Models\Area;
use App\Models\Branch;
use App\Models\CircuitBreaker;
use App\Models\CompanyFormTemplate;
use App\Models\DisconnectionList;
use App\Models\Governorate;
use App\Models\MessageBatch;
use App\Models\MessageTemplate;
use App\Models\MeterBox;
use App\Models\PrintTemplate;
use App\Models\ReadingCycle;
use App\Models\SubArea;
use App\Models\Tariff;
use App\Models\TariffSegment;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * A signed-in staff member of the branch who holds no permission is refused
 * every page and action below, and the record is left as it was. These are
 * the routes that had no "forbidden" test before.
 */
class ForbiddenWithoutPermissionTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @return array<string, array{0: string, 1: string, 2: (callable(Branch): Model)|null}>
     */
    public static function protectedRoutes(): array
    {
        $area = fn (Branch $branch): Model => Area::factory()->create();
        $governorate = fn (Branch $branch): Model => Governorate::factory()->create();
        $subArea = fn (Branch $branch): Model => SubArea::factory()->create();
        $breaker = fn (Branch $branch): Model => CircuitBreaker::factory()->create();
        $tariff = fn (Branch $branch): Model => Tariff::factory()->create();
        $segment = fn (Branch $branch): Model => TariffSegment::factory()->create();
        $meterBox = fn (Branch $branch): Model => MeterBox::factory()->for($branch)->create();
        $disconnectionList = fn (Branch $branch): Model => DisconnectionList::factory()->for($branch)->create();
        $readingCycle = fn (Branch $branch): Model => ReadingCycle::factory()->for($branch)->create();
        $messageTemplate = fn (Branch $branch): Model => MessageTemplate::factory()->create();
        $messageBatch = fn (Branch $branch): Model => MessageBatch::factory()->for($branch)->create();
        $companyForm = fn (Branch $branch): Model => CompanyFormTemplate::factory()->create();
        $printTemplate = fn (Branch $branch): Model => PrintTemplate::factory()->create();
        $otherBranch = fn (Branch $branch): Model => Branch::factory()->create();

        return [
            'edit an area' => ['GET', 'areas.edit', $area],
            'update an area' => ['PUT', 'areas.update', $area],
            'delete an area' => ['DELETE', 'areas.destroy', $area],
            'edit a governorate' => ['GET', 'governorates.edit', $governorate],
            'update a governorate' => ['PUT', 'governorates.update', $governorate],
            'delete a governorate' => ['DELETE', 'governorates.destroy', $governorate],
            'edit a sub-area' => ['GET', 'sub-areas.edit', $subArea],
            'update a sub-area' => ['PUT', 'sub-areas.update', $subArea],
            'delete a sub-area' => ['DELETE', 'sub-areas.destroy', $subArea],
            'edit a branch' => ['GET', 'branches.edit', $otherBranch],
            'update a branch' => ['PUT', 'branches.update', $otherBranch],
            'delete a branch' => ['DELETE', 'branches.destroy', $otherBranch],
            'open the new breaker page' => ['GET', 'circuit-breakers.create', null],
            'edit a breaker' => ['GET', 'circuit-breakers.edit', $breaker],
            'delete a breaker' => ['DELETE', 'circuit-breakers.destroy', $breaker],
            'open the new tariff page' => ['GET', 'tariffs.create', null],
            'edit a tariff' => ['GET', 'tariffs.edit', $tariff],
            'delete a tariff' => ['DELETE', 'tariffs.destroy', $tariff],
            'delete a tariff segment' => ['DELETE', 'tariff-segments.destroy', $segment],
            'open the new meter box page' => ['GET', 'meter-boxes.create', null],
            'add a meter box' => ['POST', 'meter-boxes.store', null],
            'edit a meter box' => ['GET', 'meter-boxes.edit', $meterBox],
            'update a meter box' => ['PUT', 'meter-boxes.update', $meterBox],
            'delete a meter box' => ['DELETE', 'meter-boxes.destroy', $meterBox],
            'open a disconnection list' => ['POST', 'disconnection-lists.store', null],
            'change a disconnection list' => ['PATCH', 'disconnection-lists.update', $disconnectionList],
            'see disconnection candidates' => ['GET', 'disconnection-lists.candidates', $disconnectionList],
            'prepare a reading cycle' => ['POST', 'reading-cycles.store', null],
            'open a reading cycle' => ['GET', 'reading-cycles.show', $readingCycle],
            'change a reading cycle' => ['PATCH', 'reading-cycles.update', $readingCycle],
            'copy last week into a cycle' => ['POST', 'reading-cycles.copy-previous', $readingCycle],
            'see held mobile readings' => ['GET', 'reading-cycles.submissions.index', $readingCycle],
            'add a message template' => ['POST', 'message-templates.store', null],
            'change a message template' => ['PUT', 'message-templates.update', $messageTemplate],
            'delete a message template' => ['DELETE', 'message-templates.destroy', $messageTemplate],
            'open a message send' => ['GET', 'messages.show', $messageBatch],
            'retry a message send' => ['POST', 'messages.retry', $messageBatch],
            'open the new company form page' => ['GET', 'company-forms.create', null],
            'open a company form' => ['GET', 'company-forms.show', $companyForm],
            'change a company form' => ['POST', 'company-forms.update', $companyForm],
            'delete a company form' => ['DELETE', 'company-forms.destroy', $companyForm],
            'download a company form source' => ['GET', 'company-forms.source', $companyForm],
            'change a print template' => ['PUT', 'print-templates.update', $printTemplate],
            'copy a print template' => ['POST', 'print-templates.duplicate', $printTemplate],
        ];
    }

    /**
     * @param  (callable(Branch): Model)|null  $makeRecord
     */
    #[DataProvider('protectedRoutes')]
    public function test_a_staff_member_without_permissions_is_refused(string $method, string $routeName, ?callable $makeRecord): void
    {
        $branch = Branch::factory()->create();
        $staff = User::factory()->collector()->for($branch)->create();
        $staff->permissions()->sync([]);
        $record = $makeRecord === null ? null : $makeRecord($branch);
        $before = $record?->fresh()?->getAttributes();

        $response = $this->actingAs($staff)->call($method, route($routeName, $record === null ? [] : [$record]));

        $response->assertForbidden();
        if ($record !== null) {
            $this->assertSame($before, $record->fresh()?->getAttributes());
        }
    }
}
