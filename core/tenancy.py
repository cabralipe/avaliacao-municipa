from typing import Any, Iterable, Optional, Type

from django.db import models
from rest_framework import exceptions, permissions
from rest_framework.permissions import SAFE_METHODS
from rest_framework.request import Request
from rest_framework.viewsets import ModelViewSet


class IsSameSecretaria(permissions.BasePermission):
    """Ensure the authenticated user matches the secretaria bound to the object."""

    def has_object_permission(self, request: Request, view: Any, obj: Any) -> bool:
        user_sec = getattr(request.user, 'secretaria_id', None)
        obj_sec = getattr(obj, 'secretaria_id', None)
        if obj_sec is None:
            return getattr(request.user, 'role', '') == 'superadmin'
        return user_sec == obj_sec


class TenantScopedViewSet(ModelViewSet):
    """Base ViewSet enforcing secretaria scoping on list/create operations."""

    tenant_field = 'secretaria'
    role_permissions: dict[str, Iterable[str]] = {}
    allow_superadmin_override: bool = True

    def get_permissions(self):
        """Allow OPTIONS requests without authentication for CORS preflight."""
        if self.request.method == 'OPTIONS':
            return []
        return super().get_permissions()

    def check_permissions(self, request):
        super().check_permissions(request)
        self._enforce_role_permissions(request)

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        user_sec = getattr(user, 'secretaria_id', None)
        if getattr(user, 'role', '') == 'superadmin':
            return queryset
        if user_sec is None:
            return queryset.none()
        return queryset.filter(**{f"{self.tenant_field}_id": user_sec})

    # Helpers -----------------------------------------------------------------

    def _resolve_allowed_roles(self, request: Request) -> Optional[set[str]]:
        mapping = getattr(self, 'role_permissions', None) or {}
        if not mapping:
            return None

        action = getattr(self, 'action', None)
        allowed: Optional[Iterable[str]] = None

        if action and action in mapping:
            allowed = mapping[action]
        else:
            method_key = request.method.lower()
            allowed = mapping.get(method_key)
            if allowed is None:
                if request.method in SAFE_METHODS:
                    allowed = mapping.get('read') or mapping.get('safe')
                else:
                    allowed = mapping.get('write') or mapping.get('*')

        if allowed is None:
            return None
        return set(allowed)

    def _enforce_role_permissions(self, request: Request) -> None:
        allowed_roles = self._resolve_allowed_roles(request)
        if not allowed_roles:
            return

        user_role = getattr(request.user, 'role', None)
        if self.allow_superadmin_override and user_role == 'superadmin':
            return

        if user_role not in allowed_roles:
            raise exceptions.PermissionDenied({'detail': 'Você não tem permissão para executar esta ação.'})

    def _get_tenant_model(self) -> Type[models.Model]:
        field = self.get_queryset().model._meta.get_field(self.tenant_field)
        if not isinstance(field, models.ForeignKey):
            raise exceptions.ValidationError({self.tenant_field: 'Campo de tenant inválido.'})
        return field.remote_field.model

    def _tenant_allows_null(self) -> bool:
        field = self.get_queryset().model._meta.get_field(self.tenant_field)
        return getattr(field, 'null', False)

    def _resolve_tenant(self, instance: Optional[models.Model] = None) -> Optional[models.Model]:
        """Determina a secretaria que deve ser aplicada na operação atual."""

        field_name = self.tenant_field
        user = self.request.user
        user_role = getattr(user, 'role', '')

        if user_role == 'superadmin':
            data = getattr(self.request, 'data', {}) or {}
            raw_value = data.get(f'{field_name}_id') or data.get(field_name)
            if raw_value in (None, '', 'null'):
                return getattr(instance, field_name, None) if instance is not None else None
            tenant_model = self._get_tenant_model()
            try:
                return tenant_model.objects.get(pk=raw_value)
            except tenant_model.DoesNotExist:  # type: ignore[attr-defined]
                raise exceptions.ValidationError({field_name: 'Secretaria informada não existe.'})
            except (TypeError, ValueError):
                raise exceptions.ValidationError({field_name: 'Valor inválido para secretaria.'})

        tenant = getattr(user, field_name, None)
        if tenant is None:
            if self._tenant_allows_null():
                return None
            raise exceptions.ValidationError({'detail': 'Usuário não está vinculado a uma secretaria.'})
        return tenant

    def perform_create(self, serializer):
        tenant = self._resolve_tenant()
        save_kwargs = {}
        if tenant is not None or not self._tenant_allows_null():
            save_kwargs[self.tenant_field] = tenant
        serializer.save(**save_kwargs)

    def perform_update(self, serializer):
        tenant = self._resolve_tenant(instance=serializer.instance)
        save_kwargs = {}
        if tenant is not None or not self._tenant_allows_null():
            save_kwargs[self.tenant_field] = tenant
        serializer.save(**save_kwargs)
