from typing import Any

from rest_framework import permissions
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

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        user_sec = getattr(user, 'secretaria_id', None)
        if getattr(user, 'role', '') == 'superadmin':
            return queryset
        if user_sec is None:
            return queryset.none()
        return queryset.filter(**{f"{self.tenant_field}_id": user_sec})

    def perform_create(self, serializer):
        serializer.save(**{self.tenant_field: self.request.user.secretaria})
