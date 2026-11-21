<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Auth\Events\Lockout;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

/**
 * What stands between a guesser and an account: the lockout after five
 * wrong tries, the answers that do not reveal which part was wrong, the
 * fresh session on sign-in, and the redirect that stays on this site.
 */
class LoginProtectionTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_sixth_try_is_locked_with_the_wait_message_and_reports_a_lockout(): void
    {
        $this->freezeTime();
        Event::fake([Lockout::class]);
        $user = User::factory()->create();
        $this->failToSignIn($user->username, times: 5);

        $response = $this->post('/login', ['username' => $user->username, 'password' => 'password']);

        $response->assertSessionHasErrors(['username' => 'محاولات دخول كثيرة جدًا. الرجاء المحاولة مرة أخرى بعد 60 ثانية.']);
        $this->assertGuest();
        Event::assertDispatched(Lockout::class);
    }

    public function test_a_successful_sign_in_clears_the_earlier_wrong_tries(): void
    {
        $user = User::factory()->create();
        $this->failToSignIn($user->username, times: 4);
        $this->post('/login', ['username' => $user->username, 'password' => 'password']);
        $this->post('/logout');
        $this->failToSignIn($user->username, times: 4);

        $this->post('/login', ['username' => $user->username, 'password' => 'password']);

        $this->assertAuthenticatedAs($user);
    }

    public function test_locking_one_username_does_not_lock_another_from_the_same_address(): void
    {
        $locked = User::factory()->create();
        $other = User::factory()->create();
        $this->failToSignIn($locked->username, times: 5);

        $this->post('/login', ['username' => $other->username, 'password' => 'password']);

        $this->assertAuthenticatedAs($other);
    }

    public function test_an_unknown_username_gets_the_same_answer_as_a_wrong_password(): void
    {
        $response = $this->post('/login', ['username' => 'nobody-here', 'password' => 'password']);

        $response->assertSessionHasErrors(['username' => 'بيانات الدخول هذه غير متطابقة مع سجلاتنا.']);
        $this->assertGuest();
    }

    public function test_empty_fields_are_both_required(): void
    {
        $response = $this->post('/login', []);

        $response->assertSessionHasErrors(['username', 'password']);
        $this->assertGuest();
    }

    public function test_an_intended_address_on_another_site_is_dropped_for_the_dashboard(): void
    {
        $user = User::factory()->create();

        $response = $this->withSession(['url.intended' => 'https://evil.example/collect'])
            ->post('/login', ['username' => $user->username, 'password' => 'password']);

        $response->assertRedirect(route('dashboard', absolute: false));
    }

    public function test_an_intended_address_on_this_site_is_kept(): void
    {
        $user = User::factory()->create();

        $response = $this->withSession(['url.intended' => url('/subscriptions')])
            ->post('/login', ['username' => $user->username, 'password' => 'password']);

        $response->assertRedirect(url('/subscriptions'));
    }

    public function test_signing_in_starts_a_new_session(): void
    {
        $user = User::factory()->create();
        $this->get('/login');
        $before = session()->getId();

        $this->post('/login', ['username' => $user->username, 'password' => 'password']);

        $this->assertNotSame($before, session()->getId());
    }

    public function test_a_signed_in_user_opening_the_sign_in_page_goes_to_the_dashboard(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->get('/login');

        $response->assertRedirect(route('dashboard', absolute: false));
    }

    public function test_the_app_gets_429_after_five_wrong_tries(): void
    {
        $this->freezeTime();
        $user = User::factory()->create();
        foreach (range(1, 5) as $try) {
            $this->postJson(route('mobile.login'), ['username' => $user->username, 'password' => 'wrong-password'])->assertUnprocessable();
        }

        $response = $this->postJson(route('mobile.login'), ['username' => $user->username, 'password' => 'password']);

        $response->assertTooManyRequests();
        $response->assertJsonPath('message', 'محاولات دخول كثيرة جدًا. الرجاء المحاولة مرة أخرى بعد 60 ثانية.');
        $this->assertDatabaseCount('mobile_access_tokens', 0);
    }

    public function test_the_app_gets_401_for_a_token_the_server_never_issued(): void
    {
        $response = $this->withToken('not-a-real-token')->getJson(route('mobile.me'));

        $response->assertUnauthorized();
    }

    private function failToSignIn(string $username, int $times): void
    {
        foreach (range(1, $times) as $try) {
            $this->post('/login', ['username' => $username, 'password' => 'wrong-password']);
        }
    }
}
