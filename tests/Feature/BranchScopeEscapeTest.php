<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Subscription;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Symfony\Component\Finder\Finder;
use Tests\TestCase;

class BranchScopeEscapeTest extends TestCase
{
    use RefreshDatabase;

    public function test_only_the_branch_scope_itself_removes_the_branch_scope(): void
    {
        $offenders = [];

        foreach (Finder::create()->files()->in(app_path())->name('*.php') as $file) {
            if ($file->getRelativePathname() === 'Support/BranchDomainScope.php') {
                continue;
            }

            if (preg_match('/withoutGlobalScopes?\(/', $file->getContents())) {
                $offenders[] = $file->getRelativePathname();
            }
        }

        $this->assertSame([], $offenders, 'Read across branches with acrossBranches(), not withoutGlobalScope().');
    }

    public function test_across_branches_reads_past_the_branch_host_and_the_scope_still_applies_otherwise(): void
    {
        $here = Branch::factory()->create();
        $elsewhere = Branch::factory()->create();
        $ours = Subscription::factory()->for($here)->create();
        $theirs = Subscription::factory()->for($elsewhere)->create();

        request()->attributes->add(['domain_branch' => $here, 'branch_domain_authorized' => true]);

        $this->assertSame([$ours->id], Subscription::query()->pluck('id')->all());
        $this->assertEqualsCanonicalizing([$ours->id, $theirs->id], Subscription::query()->acrossBranches()->pluck('id')->all());
    }
}
