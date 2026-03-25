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
    cities,
    admin_users,
    block_user,
    unblock_user,
    admin_reviews,
    hide_review,
    show_review,
    admin_block_user,
    admin_unblock_user,
    admin_hide_review,
    admin_show_review
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
    path("admin/users/", admin_users),
    path("admin/users/<int:user_id>/block/", block_user),
    path("admin/users/<int:user_id>/unblock/", unblock_user),
    path("admin/reviews/", admin_reviews),
    path("admin/reviews/<int:review_id>/hide/", hide_review),
    path("admin/reviews/<int:review_id>/show/", show_review),
    path("admin/users/", admin_users),
    path("admin/users/<int:user_id>/block/", admin_block_user),
    path("admin/users/<int:user_id>/unblock/", admin_unblock_user),
    path("admin/reviews/", admin_reviews),
    path("admin/reviews/<int:review_id>/hide/", admin_hide_review),
    path("admin/reviews/<int:review_id>/show/", admin_show_review),
]