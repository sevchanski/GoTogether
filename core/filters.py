# core/filters.py
from django_filters import rest_framework as filters
from .models import Trip

class TripFilter(filters.FilterSet):
    # ✅ дата
    departure_date = filters.DateFilter(field_name="departure_time", lookup_expr="date")

    # ✅ місто
    city = filters.CharFilter(field_name="city", lookup_expr="iexact")

    # ✅ зручно: частковий збіг по origin/destination
    origin = filters.CharFilter(field_name="origin", lookup_expr="icontains")
    destination = filters.CharFilter(field_name="destination", lookup_expr="icontains")

    class Meta:
        model = Trip
        fields = ["city", "origin", "destination", "departure_date"]