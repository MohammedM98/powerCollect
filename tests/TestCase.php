<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    /**
     * Pages render without compiled assets or a running SSR service, so the
     * tests pass on a fresh checkout and in CI, which only installs the
     * PHP dependencies.
     */
    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutVite();
        config(['inertia.ssr.enabled' => false]);
    }

    /**
     * Two values saved in a JSON column are the same: MySQL keeps an object's
     * keys in its own order (SQLite keeps the written one), so the keys of
     * every object are compared sorted, while lists keep their order.
     *
     * @param  array<array-key, mixed>  $expected
     * @param  array<array-key, mixed>|null  $actual
     */
    protected function assertSameJson(array $expected, ?array $actual): void
    {
        $this->assertSame($this->sortedKeys($expected), $actual === null ? null : $this->sortedKeys($actual));
    }

    /**
     * @param  array<array-key, mixed>  $value
     * @return array<array-key, mixed>
     */
    private function sortedKeys(array $value): array
    {
        $value = array_map(fn (mixed $item): mixed => is_array($item) ? $this->sortedKeys($item) : $item, $value);

        if (! array_is_list($value)) {
            ksort($value);
        }

        return $value;
    }
}
