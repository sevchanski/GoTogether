from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    TripViewSet,
    BookingViewSet,
    CarViewSet,
    MessageViewSet,
    ReviewViewSet,
    EmailLoginView,
    register,
    me,
    cities
)

router = DefaultRouter()

router.register(r"trips", TripViewSet)
router.register(r"bookings", BookingViewSet)
router.register(r"cars", CarViewSet)
router.register(r"messages", MessageViewSet)
router.register(r"reviews", ReviewViewSet)

urlpatterns = [
    path("", include(router.urls)),

    path("register/", register),
    path("me/", me),

    path("cities/", cities),

    path("token/", EmailLoginView.as_view()),
]