<?php

namespace App\Support\Messaging;

/**
 * Builds the HTTP gateway for a provider's settings: the saved ones that
 * send every message, or those on the settings page while they are tested
 * before being saved. Kept in the container so tests can stand in for it.
 */
class SmsGatewayFactory
{
    /**
     * @param  array{url: ?string, method: string, token: ?string, username_param?: ?string, username?: ?string, password_param?: ?string, password?: ?string, to_param: string, message_param: string, sender_param: ?string, sender: ?string, extra_params: ?string, success_match: ?string, phone_format: string}  $config
     */
    public function make(array $config, string $countryCode): SmsGateway
    {
        return new HttpSmsGateway($config, $countryCode);
    }
}
