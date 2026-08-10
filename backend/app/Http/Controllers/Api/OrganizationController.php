<?php

namespace App\Http\Controllers\Api;

use App\Models\Branch;
use App\Models\Client;
use App\Models\Role;
use App\Models\Supplier;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class OrganizationController extends ApiController
{
    public function index(Request $request): JsonResponse
    {
        $companyId = $this->companyId($request);
        $company = $this->user($request)->company()
            ->with(['branches', 'roles', 'users.role', 'users.branch'])
            ->firstOrFail();

        return response()->json([
            'company' => $company,
            'clients' => Client::query()->forCompany($companyId)->orderBy('name')->get(),
            'suppliers' => Supplier::query()->forCompany($companyId)->orderBy('name')->get(),
        ]);
    }

    public function updateCompany(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'registration_number' => ['nullable', 'string', 'max:120'],
            'tax_id' => ['nullable', 'string', 'max:120'],
            'default_currency' => ['sometimes', 'string', 'size:3'],
            'country' => ['sometimes', 'string', 'size:2'],
            'base_timezone' => ['sometimes', 'string', 'max:80'],
            'settings' => ['nullable', 'array'],
            'settings.appearance' => ['nullable', 'array'],
            'settings.appearance.theme' => ['nullable', Rule::in(['light', 'dark'])],
        ]);

        $company = $this->user($request)->company;

        if (array_key_exists('settings', $data)) {
            $data['settings'] = array_replace_recursive($company->settings ?? [], $data['settings'] ?? []);
        }

        $company->update($data);

        return response()->json(['company' => $company->fresh(['branches', 'roles'])]);
    }

    public function destroyCompany(Request $request): JsonResponse
    {
        $company = $this->user($request)->company;
        $company->update(['status' => 'inactive']);
        $company->delete();

        $this->user($request)->tokens()->delete();

        return response()->json(['message' => 'Company archived.']);
    }

    public function storeBranch(Request $request): JsonResponse
    {
        $companyId = $this->companyId($request);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'code' => ['nullable', 'string', 'max:24', Rule::unique('branches')->where('company_id', $companyId)],
            'city' => ['nullable', 'string', 'max:120'],
            'country' => ['nullable', 'string', 'size:2'],
            'phone' => ['nullable', 'string', 'max:60'],
            'email' => ['nullable', 'email', 'max:255'],
            'address' => ['nullable', 'string', 'max:2000'],
        ]);

        $branch = Branch::query()->create([
            'company_id' => $companyId,
            ...$data,
            'code' => $this->suppliedCode($data['code'] ?? null)
                ?? $this->nextCompanyCode($this->codePrefix($data['name'], 'BRN'), Branch::class, 'code', $companyId),
            'country' => strtoupper($data['country'] ?? $this->user($request)->company->country),
        ]);

        return response()->json(['branch' => $branch], 201);
    }

    public function storeUser(Request $request): JsonResponse
    {
        $companyId = $this->companyId($request);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', $this->passwordRule()],
            'branch_id' => ['required', 'integer'],
            'role_id' => ['nullable', 'integer'],
            'role_name' => ['required_without:role_id', 'nullable', 'string', 'max:120'],
            'permissions' => ['nullable', 'array'],
            'permissions.*' => ['string', 'max:120'],
            'phone' => ['nullable', 'string', 'max:60'],
        ]);

        Branch::query()->forCompany($companyId)->whereKey($data['branch_id'])->firstOrFail();
        $role = $this->resolveUserRole($data, $companyId);
        $data['role_id'] = $role->id;
        unset($data['role_name']);

        $user = User::query()->create([
            'company_id' => $companyId,
            ...$data,
            'password_changed_at' => now(),
            'permissions' => array_key_exists('permissions', $data) ? $this->normalizePermissions($data['permissions']) : null,
        ]);

        return response()->json(['user' => $user->load(['branch', 'role'])], 201);
    }

    public function storeRole(Request $request): JsonResponse
    {
        $companyId = $this->companyId($request);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'permissions' => ['nullable', 'array'],
            'permissions.*' => ['string', 'max:120'],
        ]);

        $role = Role::query()->create([
            'company_id' => $companyId,
            'name' => $data['name'],
            'slug' => $this->uniqueRoleSlug($data['name'], $companyId),
            'permissions' => $this->normalizePermissions($data['permissions'] ?? []),
            'is_system' => false,
        ]);

        return response()->json(['role' => $role], 201);
    }

    public function updateRole(Request $request, Role $role): JsonResponse
    {
        $this->assertRoleTenant($request, $role);
        abort_if($role->is_system, 422, 'System roles cannot be edited.');

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:120'],
            'permissions' => ['nullable', 'array'],
            'permissions.*' => ['string', 'max:120'],
        ]);

        if (array_key_exists('name', $data)) {
            $data['slug'] = $this->uniqueRoleSlug($data['name'], $this->companyId($request), $role);
        }

        if (array_key_exists('permissions', $data)) {
            $data['permissions'] = $this->normalizePermissions($data['permissions']);
        }

        $role->update($data);

        return response()->json(['role' => $role->fresh()]);
    }

    public function destroyRole(Request $request, Role $role): JsonResponse
    {
        $this->assertRoleTenant($request, $role);
        abort_if($role->is_system, 422, 'System roles cannot be deleted.');
        abort_if($role->users()->exists(), 422, 'Assign users to another role before deleting this role.');

        $role->delete();

        return response()->json(['message' => 'Role deleted.']);
    }

    public function updateUser(Request $request, User $user): JsonResponse
    {
        $this->assertUserTenant($request, $user);
        $companyId = $this->companyId($request);

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'email' => ['sometimes', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'password' => ['nullable', $this->passwordRule()],
            'branch_id' => ['sometimes', 'integer'],
            'role_id' => ['sometimes', 'nullable', 'integer'],
            'role_name' => ['sometimes', 'nullable', 'string', 'max:120'],
            'permissions' => ['nullable', 'array'],
            'permissions.*' => ['string', 'max:120'],
            'phone' => ['nullable', 'string', 'max:60'],
            'status' => ['sometimes', Rule::in(['active', 'inactive', 'suspended'])],
        ]);

        if (array_key_exists('branch_id', $data)) {
            Branch::query()->forCompany($companyId)->whereKey($data['branch_id'])->firstOrFail();
        }

        if (filled($data['role_name'] ?? null)) {
            $data['role_id'] = $this->resolveUserRole($data, $companyId)->id;
        } elseif (array_key_exists('role_id', $data)) {
            Role::query()->forCompany($companyId)->whereKey($data['role_id'])->firstOrFail();
        }
        unset($data['role_name']);

        $passwordChanged = filled($data['password'] ?? null);
        if (blank($data['password'] ?? null)) {
            unset($data['password']);
        }

        if (array_key_exists('permissions', $data)) {
            $data['permissions'] = $this->normalizePermissions($data['permissions']);
        }

        $user->update($data);

        if ($passwordChanged) {
            $user->forceFill(['password_changed_at' => now()])->save();
            $user->tokens()->delete();
        }

        if (in_array($user->status, ['inactive', 'suspended'], true)) {
            $user->tokens()->delete();
        }

        return response()->json(['user' => $user->fresh(['branch', 'role'])]);
    }

    private function passwordRule(): Password
    {
        return Password::min(12)->letters()->mixedCase()->numbers();
    }

    private function normalizePermissions(?array $permissions): ?array
    {
        if ($permissions === null) {
            return null;
        }

        return collect($permissions)
            ->map(fn (string $permission): string => trim($permission))
            ->filter()
            ->unique()
            ->values()
            ->all();
    }

    private function uniqueRoleSlug(string $name, int $companyId, ?Role $ignore = null): string
    {
        $base = Str::slug($name) ?: 'custom-role';
        $slug = $base;
        $next = 2;

        while (
            Role::query()
                ->forCompany($companyId)
                ->when($ignore, fn ($query) => $query->whereKeyNot($ignore->id))
                ->where('slug', $slug)
                ->exists()
        ) {
            $slug = "{$base}-{$next}";
            $next++;
        }

        return $slug;
    }

    private function resolveUserRole(array $data, int $companyId): Role
    {
        if (filled($data['role_name'] ?? null)) {
            $name = trim((string) $data['role_name']);
            $slug = Str::slug($name) ?: 'custom-role';

            $existingRole = Role::query()
                ->forCompany($companyId)
                ->where('slug', $slug)
                ->first();

            if ($existingRole) {
                return $existingRole;
            }

            return Role::query()->create([
                'company_id' => $companyId,
                'name' => $name,
                'slug' => $this->uniqueRoleSlug($name, $companyId),
                'permissions' => $this->normalizePermissions($data['permissions'] ?? []),
                'is_system' => false,
            ]);
        }

        return Role::query()->forCompany($companyId)->whereKey($data['role_id'])->firstOrFail();
    }

    public function destroyUser(Request $request, User $user): JsonResponse
    {
        $this->assertUserTenant($request, $user);

        abort_if($user->is($this->user($request)), 422, 'You cannot delete your own user account.');

        $user->tokens()->delete();
        $user->delete();

        return response()->json(['message' => 'User deleted.']);
    }

    public function storeClient(Request $request): JsonResponse
    {
        $data = $request->validate([
            'branch_id' => ['nullable', 'integer'],
            'name' => ['required', 'string', 'max:255'],
            'type' => ['nullable', 'string', 'max:60'],
            'contact_name' => ['nullable', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:60'],
            'address' => ['nullable', 'string', 'max:2000'],
            'currency' => ['nullable', 'string', 'size:3'],
            'notes' => ['nullable', 'string', 'max:4000'],
        ]);

        $client = Client::query()->create([
            'company_id' => $this->companyId($request),
            'currency' => strtoupper($data['currency'] ?? $this->user($request)->company->default_currency),
            ...$data,
        ]);

        return response()->json(['client' => $client], 201);
    }

    public function updateClient(Request $request, Client $client): JsonResponse
    {
        $this->assertClientTenant($request, $client);

        $data = $request->validate([
            'branch_id' => ['nullable', 'integer'],
            'name' => ['sometimes', 'string', 'max:255'],
            'type' => ['nullable', 'string', 'max:60'],
            'contact_name' => ['nullable', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:60'],
            'address' => ['nullable', 'string', 'max:2000'],
            'currency' => ['nullable', 'string', 'size:3'],
            'status' => ['sometimes', Rule::in(['active', 'inactive'])],
            'notes' => ['nullable', 'string', 'max:4000'],
        ]);

        if (! empty($data['branch_id'])) {
            Branch::query()->forCompany($this->companyId($request))->whereKey($data['branch_id'])->firstOrFail();
        }

        if (isset($data['currency'])) {
            $data['currency'] = strtoupper($data['currency']);
        }

        $client->update($data);

        return response()->json(['client' => $client->fresh()]);
    }

    public function destroyClient(Request $request, Client $client): JsonResponse
    {
        $this->assertClientTenant($request, $client);
        $client->delete();

        return response()->json(['message' => 'Client archived.']);
    }

    public function storeSupplier(Request $request): JsonResponse
    {
        $data = $request->validate([
            'branch_id' => ['nullable', 'integer'],
            'name' => ['required', 'string', 'max:255'],
            'contact_name' => ['nullable', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:60'],
            'address' => ['nullable', 'string', 'max:2000'],
            'currency' => ['nullable', 'string', 'size:3'],
            'rating' => ['nullable', 'integer', 'between:1,5'],
            'lead_time_days' => ['nullable', 'integer', 'min:0', 'max:365'],
        ]);

        $supplier = Supplier::query()->create([
            'company_id' => $this->companyId($request),
            'currency' => strtoupper($data['currency'] ?? $this->user($request)->company->default_currency),
            ...$data,
        ]);

        return response()->json(['supplier' => $supplier], 201);
    }

    public function updateSupplier(Request $request, Supplier $supplier): JsonResponse
    {
        $this->assertSupplierTenant($request, $supplier);

        $data = $request->validate([
            'branch_id' => ['nullable', 'integer'],
            'name' => ['sometimes', 'string', 'max:255'],
            'contact_name' => ['nullable', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:60'],
            'address' => ['nullable', 'string', 'max:2000'],
            'currency' => ['nullable', 'string', 'size:3'],
            'rating' => ['nullable', 'integer', 'between:1,5'],
            'lead_time_days' => ['nullable', 'integer', 'min:0', 'max:365'],
            'status' => ['sometimes', Rule::in(['active', 'inactive'])],
        ]);

        if (! empty($data['branch_id'])) {
            Branch::query()->forCompany($this->companyId($request))->whereKey($data['branch_id'])->firstOrFail();
        }

        if (isset($data['currency'])) {
            $data['currency'] = strtoupper($data['currency']);
        }

        $supplier->update($data);

        return response()->json(['supplier' => $supplier->fresh()]);
    }

    public function destroySupplier(Request $request, Supplier $supplier): JsonResponse
    {
        $this->assertSupplierTenant($request, $supplier);
        $supplier->delete();

        return response()->json(['message' => 'Supplier archived.']);
    }

    private function assertUserTenant(Request $request, User $user): void
    {
        abort_unless((int) $user->company_id === $this->companyId($request), 404);
    }

    private function assertRoleTenant(Request $request, Role $role): void
    {
        abort_unless((int) $role->company_id === $this->companyId($request), 404);
    }

    private function assertClientTenant(Request $request, Client $client): void
    {
        abort_unless((int) $client->company_id === $this->companyId($request), 404);
    }

    private function assertSupplierTenant(Request $request, Supplier $supplier): void
    {
        abort_unless((int) $supplier->company_id === $this->companyId($request), 404);
    }
}
