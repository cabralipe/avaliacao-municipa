import pytest
from django.urls import reverse
from model_bakery import baker
from rest_framework import status
from rest_framework.test import APIClient


@pytest.mark.django_db
def test_secretaria_viewset_requires_superadmin():
    secretaria = baker.make('core.Secretaria')
    user = baker.make('core.User', role='admin', secretaria=secretaria)

    client = APIClient()
    client.force_authenticate(user=user)

    response = client.get(reverse('secretaria-list'))
    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_secretaria_viewset_allows_superadmin_crud():
    baker.make('core.Secretaria', nome='Rede A')
    superadmin = baker.make('core.User', role='superadmin', secretaria=None)

    client = APIClient()
    client.force_authenticate(user=superadmin)

    list_response = client.get(reverse('secretaria-list'))
    assert list_response.status_code == status.HTTP_200_OK
    assert list_response.json()['count'] == 1

    create_response = client.post(
        reverse('secretaria-list'),
        {'nome': 'Rede B', 'cnpj': '00.000.000/0001-00', 'cidade': 'Cidade B'},
        format='json',
    )
    assert create_response.status_code == status.HTTP_201_CREATED

    secretaria_id = create_response.json()['id']

    detail_url = reverse('secretaria-detail', args=[secretaria_id])
    update_response = client.patch(detail_url, {'cidade': 'Cidade Atualizada'}, format='json')
    assert update_response.status_code == status.HTTP_200_OK
    assert update_response.json()['cidade'] == 'Cidade Atualizada'

    delete_response = client.delete(detail_url)
    assert delete_response.status_code == status.HTTP_204_NO_CONTENT
