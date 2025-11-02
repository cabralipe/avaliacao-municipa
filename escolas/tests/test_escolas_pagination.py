import pytest
from django.urls import reverse
from model_bakery import baker
from rest_framework.test import APIClient


@pytest.mark.django_db
def test_escolas_list_is_paginated_by_default():
    secretaria = baker.make('core.Secretaria')
    baker.make('escolas.Escola', secretaria=secretaria, _quantity=25)
    user = baker.make('core.User', secretaria=secretaria, role='admin')

    client = APIClient()
    client.force_authenticate(user=user)

    response = client.get(reverse('escola-list'))
    assert response.status_code == 200
    payload = response.json()
    assert payload['count'] == 25
    assert len(payload['results']) == 20


@pytest.mark.django_db
def test_escolas_list_can_disable_pagination():
    secretaria = baker.make('core.Secretaria')
    baker.make('escolas.Escola', secretaria=secretaria, _quantity=12)
    user = baker.make('core.User', secretaria=secretaria, role='admin')

    client = APIClient()
    client.force_authenticate(user=user)

    response = client.get(reverse('escola-list'), {'page_size': 0})
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 12
