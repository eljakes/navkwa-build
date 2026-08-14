<?php

return [
    'auth' => [
        'max_failed_login_attempts' => (int) env('SECURITY_MAX_FAILED_LOGIN_ATTEMPTS', 4),
        'lockout_minutes' => (int) env('SECURITY_LOCKOUT_MINUTES', 30),
        'mfa_challenge_minutes' => (int) env('SECURITY_MFA_CHALLENGE_MINUTES', 5),
        'require_mfa_for_platform_admins' => filter_var(env('SECURITY_REQUIRE_MFA_FOR_PLATFORM_ADMINS', false), FILTER_VALIDATE_BOOLEAN),
        'revoke_other_web_tokens_on_login' => filter_var(env('SECURITY_REVOKE_OTHER_WEB_TOKENS_ON_LOGIN', true), FILTER_VALIDATE_BOOLEAN),
    ],

    'tokens' => [
        'web_token_lifetime_minutes' => (int) env('SECURITY_WEB_TOKEN_LIFETIME_MINUTES', 240),
    ],

    'rate_limits' => [
        'api_per_minute' => (int) env('SECURITY_API_RATE_LIMIT_PER_MINUTE', 120),
        'login_per_minute' => (int) env('SECURITY_LOGIN_RATE_LIMIT_PER_MINUTE', 5),
        'login_ip_per_minute' => (int) env('SECURITY_LOGIN_IP_RATE_LIMIT_PER_MINUTE', 20),
        'login_email_per_minute' => (int) env('SECURITY_LOGIN_EMAIL_RATE_LIMIT_PER_MINUTE', 10),
        'mfa_per_minute' => (int) env('SECURITY_MFA_RATE_LIMIT_PER_MINUTE', 5),
        'mfa_ip_per_minute' => (int) env('SECURITY_MFA_IP_RATE_LIMIT_PER_MINUTE', 15),
    ],

    'headers' => [
        'content_security_policy' => env(
            'SECURITY_CONTENT_SECURITY_POLICY',
            "default-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
        ),
        'permissions_policy' => env(
            'SECURITY_PERMISSIONS_POLICY',
            'camera=(), microphone=(), geolocation=(), payment=(), usb=(), fullscreen=(self)',
        ),
        'hsts_max_age' => (int) env('SECURITY_HSTS_MAX_AGE', 31536000),
    ],
];
