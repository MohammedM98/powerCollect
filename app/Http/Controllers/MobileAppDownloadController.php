<?php

namespace App\Http\Controllers;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Http;
use Inertia\Inertia;
use Inertia\Response;

class MobileAppDownloadController extends Controller
{
    private const REPOSITORY = 'MohammedM98/powerCollect';

    private const ASSET = 'powercollect.apk';

    public function index(): Response
    {
        $release = $this->release();

        return Inertia::render('Settings/MobileApp', [
            'release' => $release === null ? null : [
                'version' => $release['version'],
                'sizeMb' => round($release['size'] / 1048576, 1),
                'sha256' => $release['sha256'],
                'downloadUrl' => route('settings.mobile-app.download'),
            ],
        ]);
    }

    public function download(): RedirectResponse
    {
        $release = $this->release();
        abort_if($release === null, 404);

        $token = config('powercollect.mobile_app.github_token');
        $target = blank($token) ? $release['download_url'] : $this->signedAssetUrl($release['version'], $token);

        return redirect()->away($target, 302, [
            'Cache-Control' => 'private, no-store',
            'Referrer-Policy' => 'no-referrer',
        ]);
    }

    /**
     * Asks GitHub for the short-lived signed link to the APK attached to the private release.
     */
    private function signedAssetUrl(string $version, string $token): string
    {
        $github = Http::baseUrl('https://api.github.com/repos/'.self::REPOSITORY)
            ->withToken($token)
            ->withHeaders(['X-GitHub-Api-Version' => '2022-11-28'])
            ->timeout(15);

        try {
            $assets = $github->acceptJson()->get('releases/tags/android-v'.$version)->throw()->json('assets');
            $asset = collect(is_array($assets) ? $assets : [])->firstWhere('name', self::ASSET);
            abort_if(! is_array($asset) || ! is_int($asset['id'] ?? null), 404);

            $location = $github->withOptions(['allow_redirects' => false])->accept('application/octet-stream')
                ->get('releases/assets/'.$asset['id'])->throw()->header('Location');
        } catch (ConnectionException|RequestException) {
            abort(503);
        }

        abort_unless(is_string($location) && str_starts_with($location, 'https://'), 503);

        return $location;
    }

    /** @return array{version: string, size: int, sha256: string, download_url: string}|null */
    private function release(): ?array
    {
        $metadata = $this->directory().'/release.json';
        if (! is_file($metadata)) {
            return null;
        }
        $release = json_decode(file_get_contents($metadata), true);
        if (! is_array($release) || ($release['type'] ?? null) !== 'release'
            || ! is_string($release['version'] ?? null) || ! preg_match('/^\d+\.\d+\.\d+$/', $release['version'])
            || ! is_string($release['sha256'] ?? null) || ! preg_match('/^[a-f0-9]{64}$/', $release['sha256'])
            || ! is_int($release['size'] ?? null) || $release['size'] <= 0
            || ($release['download_url'] ?? null) !== 'https://github.com/'.self::REPOSITORY.'/releases/download/android-v'.$release['version'].'/'.self::ASSET) {
            return null;
        }

        return ['version' => $release['version'], 'size' => $release['size'], 'sha256' => $release['sha256'], 'download_url' => $release['download_url']];
    }

    private function directory(): string
    {
        return config('powercollect.mobile_app.directory');
    }
}
