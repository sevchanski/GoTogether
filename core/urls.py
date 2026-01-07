from rest_framework import routers
from .views import TripViewSet, BookingViewSet, MessageViewSet, ReviewViewSet, home, cities, register
from .views import register_view, login_view, logout_view
from django.urls import path, include

router = routers.DefaultRouter()
router.register(r'trips', TripViewSet)
router.register(r'bookings', BookingViewSet)
router.register(r'messages', MessageViewSet)
router.register(r'reviews', ReviewViewSet)

urlpatterns = [
    path('', home, name='home'),               # головна сторінка
    path('api/', include(router.urls)),        # всі ViewSet API
    path('api/cities/', cities, name='cities'), # <- Додано endpoint для автокомпліту міст
    path('api/register/', register, name='register'),
    path('login/', login_view, name='login'),       # сторінка логіну
    path('register/', register_view, name='register'), # сторінка реєстрації
    path('logout/', logout_view, name='logout'),   # вихід
]
