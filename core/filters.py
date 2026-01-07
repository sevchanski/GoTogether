# core/filters.py
from django_filters import rest_framework as filters
from .models import Trip

class TripFilter(filters.FilterSet):
    departure_date = filters.DateFilter(field_name='departure_time', lookup_expr='date')

    class Meta:
        model = Trip
        fields = ['origin', 'destination', 'departure_date']
