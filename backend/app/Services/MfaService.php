<?php

namespace App\Services;

use App\Models\PortalUser;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class MfaService
{
    private const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

    public function generateSecret(int $bytes = 20): string
    {
        return $this->base32Encode(random_bytes($bytes));
    }

    public function otpauthUri(User|PortalUser $user, string $secret): string
    {
        $issuer = rawurlencode((string) config('app.name', 'Navkwa Build'));
        $label = rawurlencode(config('app.name', 'Navkwa Build').':'.$user->email);

        return "otpauth://totp/{$label}?secret={$secret}&issuer={$issuer}&algorithm=SHA1&digits=6&period=30";
    }

    public function verifyCode(?string $secret, ?string $code, int $window = 1): bool
    {
        $secret = $this->normalizeSecret($secret);
        $code = preg_replace('/\s+/', '', (string) $code);

        if ($secret === '' || ! preg_match('/^\d{6}$/', $code)) {
            return false;
        }

        $counter = intdiv(time(), 30);
        for ($offset = -$window; $offset <= $window; $offset++) {
            if (hash_equals($this->hotp($secret, $counter + $offset), $code)) {
                return true;
            }
        }

        return false;
    }

    public function currentCode(string $secret): string
    {
        return $this->hotp($secret, intdiv(time(), 30));
    }

    public function generateRecoveryCodes(int $count = 10): array
    {
        return collect(range(1, $count))
            ->map(fn (): string => $this->formatRecoveryCode(Str::upper(Str::random(12))))
            ->all();
    }

    public function hashRecoveryCodes(array $codes): array
    {
        return collect($codes)
            ->map(fn (string $code): string => Hash::make($this->normalizeRecoveryCode($code)))
            ->all();
    }

    public function consumeRecoveryCode(User|PortalUser $user, ?string $code): bool
    {
        $normalized = $this->normalizeRecoveryCode((string) $code);
        if ($normalized === '') {
            return false;
        }

        $hashes = array_values($user->mfa_recovery_codes ?? []);
        foreach ($hashes as $index => $hash) {
            if (Hash::check($normalized, $hash)) {
                unset($hashes[$index]);
                $user->forceFill([
                    'mfa_recovery_codes' => array_values($hashes),
                    'mfa_last_used_at' => now(),
                ])->save();

                return true;
            }
        }

        return false;
    }

    private function hotp(string $secret, int $counter): string
    {
        $key = $this->base32Decode($secret);
        $binaryCounter = pack('N*', 0, $counter);
        $hash = hash_hmac('sha1', $binaryCounter, $key, true);
        $offset = ord($hash[strlen($hash) - 1]) & 0x0F;
        $truncated = unpack('N', substr($hash, $offset, 4))[1] & 0x7FFFFFFF;

        return str_pad((string) ($truncated % 1000000), 6, '0', STR_PAD_LEFT);
    }

    private function base32Encode(string $value): string
    {
        $bits = '';
        foreach (str_split($value) as $character) {
            $bits .= str_pad(decbin(ord($character)), 8, '0', STR_PAD_LEFT);
        }

        return collect(str_split($bits, 5))
            ->map(fn (string $chunk): string => self::BASE32_ALPHABET[bindec(str_pad($chunk, 5, '0', STR_PAD_RIGHT))])
            ->implode('');
    }

    private function base32Decode(string $value): string
    {
        $value = $this->normalizeSecret($value);
        $bits = '';

        foreach (str_split($value) as $character) {
            $index = strpos(self::BASE32_ALPHABET, $character);
            if ($index === false) {
                continue;
            }

            $bits .= str_pad(decbin($index), 5, '0', STR_PAD_LEFT);
        }

        $decoded = '';
        foreach (str_split($bits, 8) as $byte) {
            if (strlen($byte) === 8) {
                $decoded .= chr(bindec($byte));
            }
        }

        return $decoded;
    }

    private function normalizeSecret(?string $secret): string
    {
        return preg_replace('/[^A-Z2-7]/', '', Str::upper((string) $secret));
    }

    private function normalizeRecoveryCode(string $code): string
    {
        return preg_replace('/[^A-Z0-9]/', '', Str::upper($code));
    }

    private function formatRecoveryCode(string $code): string
    {
        return implode('-', str_split($this->normalizeRecoveryCode($code), 4));
    }
}
