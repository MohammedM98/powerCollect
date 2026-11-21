<?php

/**
 * One side of a race: boots the application in its own PHP process (and so
 * its own database connection), waits for the shared start time, sends one
 * request through the HTTP kernel and prints what came back as JSON.
 *
 * Job (JSON in argv[1]): method, uri, payload, headers, start_at, and
 * acting_user_id for a website request signed in as that user.
 */

use App\Models\User;
use Illuminate\Contracts\Http\Kernel;
use Illuminate\Http\Request;
use Illuminate\Support\ViewErrorBag;
use Inertia\Support\SessionKey;

require __DIR__.'/../../vendor/autoload.php';

$job = json_decode($argv[1], true, flags: JSON_THROW_ON_ERROR);
$app = require __DIR__.'/../../bootstrap/app.php';
$kernel = $app->make(Kernel::class);
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$server = [];
foreach ($job['headers'] ?? [] as $name => $value) {
    $server['HTTP_'.strtoupper(str_replace('-', '_', $name))] = $value;
}
$request = Request::create($job['uri'], $job['method'], [], [], [], [
    ...$server,
    'CONTENT_TYPE' => 'application/json',
    'HTTP_ACCEPT' => $job['accept'] ?? 'application/json',
], json_encode($job['payload'], JSON_THROW_ON_ERROR));

if (isset($job['acting_user_id'])) {
    $app['auth']->guard('web')->setUser(User::query()->findOrFail($job['acting_user_id']));
}

while (microtime(true) < $job['start_at']) {
    usleep(200);
}
$startedAt = microtime(true);
$response = $kernel->handle($request);

$session = $app->bound('session.store') ? $app['session.store'] : null;
$errors = $session?->get('errors');

echo json_encode([
    'started_at' => $startedAt,
    'status' => $response->getStatusCode(),
    'body' => json_decode((string) $response->getContent(), true),
    'location' => $response->headers->get('Location'),
    'errors' => $errors instanceof ViewErrorBag ? $errors->getBag('default')->toArray() : [],
    'flash' => $session?->get(SessionKey::FLASH_DATA) ?? [],
], JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);

$kernel->terminate($request, $response);
