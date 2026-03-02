from rest_framework import routers
from django.urls import path, include
from .views import (
    TripViewSet,
    BookingViewSet,
    MessageViewSet,
    ReviewViewSet,
    cities,
    register,
    EmailLoginView,
    me
)

router = routers.DefaultRouter()
router.register(r'trips', TripViewSet, basename='trips')
router.register(r'bookings', BookingViewSet, basename='bookings')
router.register(r'messages', MessageViewSet, basename='messages')
router.register(r'reviews', ReviewViewSet, basename='reviews')

urlpatterns = [
    path('', include(router.urls)),
    path('cities/', cities, name="cities"),
    path('api/register/', register, name='register'),
    path('token/', EmailLoginView.as_view(), name="token_obtaim_pair"),
    path('api/me/', me, name="me"),
]