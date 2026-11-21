<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Route;
use Illuminate\Support\Collection;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/**
 * Every address the application answers is closed to a visitor who has not
 * signed in, except the few listed here on purpose. A new route added outside
 * the signed-in groups fails this test until it is protected or listed.
 */
class RouteAuthenticationTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Addresses a visitor may reach without signing in, as "METHOD uri".
     *
     * @var list<string>
     */
    private const PUBLIC_ROUTES = [
        'GET /',
        'GET login',
        'POST login',
        'GET api/mobile/brand',
        'POST api/mobile/login',
        'GET api/mobile/v1/brand',
        'POST api/mobile/v1/login',
    ];

    /**
     * Laravel's own route for private files: it answers only a signed link, so a visitor gets 403.
     *
     * @var list<string>
     */
    private const SIGNED_FILE_ROUTES = ['GET storage/{path}', 'PUT storage/{path}'];

    public function test_every_website_route_sends_a_visitor_to_the_sign_in_page(): void
    {
        $refused = [];

        foreach ($this->routes()->reject(fn (Route $route): bool => $this->isMobile($route)) as $route) {
            $response = $this->visit($route);

            if (! $response->isRedirect(route('login'))) {
                $refused[] = $this->describe($route).' answered '.$response->getStatusCode();
            }
        }

        $this->assertSame([], $refused);
    }

    public function test_every_mobile_route_returns_401_without_a_token(): void
    {
        $refused = [];

        foreach ($this->routes()->filter(fn (Route $route): bool => $this->isMobile($route)) as $route) {
            $status = $this->visit($route, json: true)->getStatusCode();

            if ($status !== 401) {
                $refused[] = $this->describe($route).' answered '.$status;
            }
        }

        $this->assertSame([], $refused);
    }

    public function test_the_public_list_names_only_routes_that_exist(): void
    {
        $existing = app('router')->getRoutes()->getRoutes();
        $described = collect($existing)->map(fn (Route $route): string => $this->describe($route))->all();

        $this->assertSame([], array_values(array_diff(self::PUBLIC_ROUTES, $described)));
    }

    /**
     * The application's own routes that are not public, the fallback or a package's.
     *
     * @return Collection<int, Route>
     */
    private function routes(): Collection
    {
        return collect(app('router')->getRoutes()->getRoutes())
            ->reject(fn (Route $route): bool => $route->isFallback || str_starts_with($route->uri(), '_') || $route->uri() === 'up')
            ->reject(fn (Route $route): bool => in_array($this->describe($route), [...self::PUBLIC_ROUTES, ...self::SIGNED_FILE_ROUTES], true))
            ->values();
    }

    private function isMobile(Route $route): bool
    {
        return str_starts_with($route->uri(), 'api/mobile/');
    }

    private function describe(Route $route): string
    {
        return $this->method($route).' '.$route->uri();
    }

    private function method(Route $route): string
    {
        return collect($route->methods())->reject(fn (string $method): bool => $method === 'HEAD')->first();
    }

    /**
     * Request the route as a visitor, with every parameter set to 1.
     */
    private function visit(Route $route, bool $json = false): TestResponse
    {
        $uri = '/'.ltrim(preg_replace(['/\{[^}]+\?\}/', '/\{[^}]+\}/'], ['', '1'], $route->uri()), '/');
        $method = $this->method($route);

        return $json ? $this->json($method, $uri) : $this->call($method, $uri);
    }
}
