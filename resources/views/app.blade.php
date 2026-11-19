@php($brand = app(\App\Support\Branding\Brand::class))
<!DOCTYPE html>
<html lang="ar" dir="rtl" {!! $brand->htmlAttributes() !!}>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="csrf-token" content="{{ csrf_token() }}">

        <title inertia>{{ config('app.name', 'Laravel') }}</title>
        <link rel="icon" href="{{ $brand->logoUrl('icon') }}">

        <!-- The faces every page shows at once (Zain for text, titles and figures; Alexandria for the company's name)
             load before the first paint, so text doesn't change width and move the page when a face arrives. -->
        <link rel="preload" href="{{ Vite::asset('resources/fonts/zain-arabic-400.woff2') }}" as="font" type="font/woff2" crossorigin>
        <link rel="preload" href="{{ Vite::asset('resources/fonts/zain-arabic-700.woff2') }}" as="font" type="font/woff2" crossorigin>
        <link rel="preload" href="{{ Vite::asset('resources/fonts/zain-arabic-800.woff2') }}" as="font" type="font/woff2" crossorigin>
        <link rel="preload" href="{{ Vite::asset('resources/fonts/zain-latin-700.woff2') }}" as="font" type="font/woff2" crossorigin>
        <link rel="preload" href="{{ Vite::asset('resources/fonts/alexandria-arabic.woff2') }}" as="font" type="font/woff2" crossorigin>

        <!-- Theme, solid or glass surfaces, table density and the side bar's width: apply the saved choices before the page paints, so there is no flash. -->
        <script nonce="{{ Vite::cspNonce() }}">
            try {
                const theme = localStorage.getItem('theme');
                if (theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                    document.documentElement.classList.add('dark');
                }
                if (localStorage.getItem('surface') === 'glass') {
                    document.documentElement.dataset.surface = 'glass';
                }
                // The density chosen in this browser, else the company's (data-ui-density).
                document.documentElement.dataset.side = localStorage.getItem('side') === 'wide' ? 'wide' : 'rail';
                if ((localStorage.getItem('table-density') ?? document.documentElement.dataset.uiDensity) === 'compact') {
                    document.documentElement.dataset.tableDensity = 'compact';
                }
            } catch (e) {}
        </script>

        <!-- Scripts -->
        @vite(['resources/css/app.css', 'resources/js/app.jsx'])

        <!-- The company's own colour, when it isn't theme.css's burgundy: after the stylesheet, so its shades win. -->
        @if ($brandStyles = $brand->stylesheet())
            <style id="brand-colors">{!! $brandStyles !!}</style>
        @endif
        @inertiaHead
    </head>
    <body class="font-sans antialiased bg-gray-50 text-gray-900">
        @inertia
    </body>
</html>
