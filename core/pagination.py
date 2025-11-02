from __future__ import annotations

from rest_framework.pagination import PageNumberPagination


class DefaultPagination(PageNumberPagination):
    """Default pagination that supports ?page_size=0 to disable paging."""

    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100

    def get_page_size(self, request):  # type: ignore[override]
        raw = request.query_params.get(self.page_size_query_param)
        if raw == '0':
            return 0
        return super().get_page_size(request)
