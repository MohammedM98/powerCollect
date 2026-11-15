<?php

namespace Tests\Feature;

use App\Http\Resources\Mobile\CollectionResource;
use App\Http\Resources\Mobile\SessionUserResource;
use App\Models\SubscriptionTransaction;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Route;
use Symfony\Component\Yaml\Yaml;
use Tests\TestCase;

class MobileApiContractTest extends TestCase
{
    use RefreshDatabase;

    /** @return array<string, mixed> */
    private function contract(): array
    {
        return Yaml::parseFile(__DIR__.'/mobile-api-contract.yaml');
    }

    public function test_every_version_one_route_is_described_and_nothing_else_is(): void
    {
        $routes = collect(app('router')->getRoutes()->getRoutes())
            ->filter(fn (Route $route): bool => str_starts_with((string) $route->getName(), 'mobile.v1.'))
            ->flatMap(fn (Route $route): array => collect($route->methods())->reject(fn (string $method): bool => $method === 'HEAD')
                ->map(fn (string $method): string => strtolower($method).' /'.substr($route->uri(), strlen('api/mobile/v1/')))->all())
            ->sort()->values()->all();

        $documented = collect($this->contract()['paths'])
            ->flatMap(fn (array $operations, string $path): array => collect(array_keys($operations))->map(fn (string $method): string => "{$method} {$path}")->all())
            ->sort()->values()->all();

        $this->assertSame($routes, $documented);
    }

    public function test_the_resources_send_every_field_the_contract_requires(): void
    {
        $schemas = $this->contract()['components']['schemas'];
        $user = User::factory()->branchAdmin()->create();
        $payment = SubscriptionTransaction::factory()->create(['type' => SubscriptionTransaction::TYPE_PAYMENT, 'payment_method' => 'cash', 'amount' => '-50', 'currency_amount' => '50'])->fresh();

        $sessionUser = (new SessionUserResource($user))->resolve();
        $collection = (new CollectionResource($payment))->resolve();

        $this->assertSame([], array_diff($schemas['SessionUser']['required'], array_keys($sessionUser)));
        $this->assertSame([], array_diff(array_keys($sessionUser), array_keys($schemas['SessionUser']['properties'])));
        $this->assertSame([], array_diff($schemas['Collection']['required'], array_keys($collection)));
        $this->assertSame([], array_diff(array_keys($collection), array_keys($schemas['Collection']['properties'])));
    }
}
