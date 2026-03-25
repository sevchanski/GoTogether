from rest_framework import viewsets, permissions, status, filters
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.permissions import IsAuthenticatedOrReadOnly, AllowAny, IsAuthenticated, IsAdminUser
from rest_framework_simplejwt.views import TokenObtainPairView
from django.db import transaction
from django.db.models import Q

from .models import Trip, Booking, Message, Review, Car, User
from .serializers import (
    UserSerializer,
    TripSerializer,
    BookingSerializer,
    MessageSerializer,
    ReviewSerializer,
    CarSerializer,
    RegisterSerializer,
    EmailTokenObtainPairSerializer,
    AdminUserSerializer,
    AdminReviewSerializer
)
from .filters import TripFilter


# ----------------------------------------
# JWT LOGIN
# ----------------------------------------
class EmailLoginView(TokenObtainPairView):
    serializer_class = EmailTokenObtainPairSerializer


# ----------------------------------------
# REGISTER API
# ----------------------------------------
@api_view(["POST"])
@permission_classes([AllowAny])
def register(request):
    serializer = RegisterSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response({"message": "Користувач створений"}, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ----------------------------------------
# CURRENT USER (ME)
# ----------------------------------------
@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
def me(request):
    if request.method == "GET":
        serializer = UserSerializer(request.user, context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    serializer = UserSerializer(
        request.user,
        data=request.data,
        partial=True,
        context={"request": request}
    )

    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ----------------------------------------
# TRIP VIEWSET (ПОЇЗДКИ)
# ----------------------------------------
class TripViewSet(viewsets.ModelViewSet):
    queryset = Trip.objects.all().order_by("departure_time")
    serializer_class = TripSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]

    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = TripFilter

    # ✅ ДОДАЛИ route_summary + city до search_fields
    # Тепер можна: /api/trips/?search=Хрещатик
    search_fields = ["origin", "destination", "city", "route_summary"]

    ordering_fields = ["departure_time", "price_per_seat"]
    ordering = ["departure_time"]

    def perform_create(self, serializer):
        if not self.request.user.is_driver:
            raise permissions.PermissionDenied("Тільки водії можуть створювати поїздки")
        serializer.save(driver=self.request.user)

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        trip = self.get_object()

        if trip.driver != request.user:
            return Response(
                {"error": "Ви не водій цієї поїздки"},
                status=status.HTTP_403_FORBIDDEN
            )

        if trip.status == "completed":
            return Response(
                {"error": "Поїздка вже завершена"},
                status=status.HTTP_400_BAD_REQUEST
            )

        trip.status = "completed"
        trip.save()

        return Response({"message": "Поїздку завершено"}, status=status.HTTP_200_OK)

    def update(self, request, *args, **kwargs):
        trip = self.get_object()

        if trip.driver != request.user:
            return Response(
                {"detail": "Ви не можете редагувати чужу поїздку"},
                status=status.HTTP_403_FORBIDDEN
            )

        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        trip = self.get_object()

        if trip.driver != request.user:
            return Response(
                {"detail": "Ви не можете редагувати чужу поїздку"},
                status=status.HTTP_403_FORBIDDEN
            )

        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        trip = self.get_object()

        if trip.driver != request.user:
            return Response(
                {"detail": "Ви не можете видаляти чужу поїздку"},
                status=status.HTTP_403_FORBIDDEN
            )

        return super().destroy(request, *args, **kwargs)

# ----------------------------------------
# BOOKING VIEWSET
# ----------------------------------------
class BookingViewSet(viewsets.ModelViewSet):
    queryset = Booking.objects.select_related("trip", "trip__driver", "passenger").all()
    serializer_class = BookingSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user

        return Booking.objects.filter(
            Q(passenger=user) | Q(trip__driver=user)
        ).select_related(
            "passenger",
            "trip",
            "trip__driver"
        ).distinct().order_by("-booked_at")
    def perform_create(self, serializer):
        serializer.save()

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        booking = self.get_object()

        # тільки водій цієї поїздки може підтвердити
        if booking.trip.driver != request.user:
            return Response(
                {"detail": "Це не ваша поїздка"},
                status=status.HTTP_403_FORBIDDEN
            )

        # підтверджувати можна тільки нову заявку
        if booking.status != "pending":
            return Response(
                {"detail": "Заявка вже оброблена"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # перевірка місць
        if booking.trip.seats_available < booking.seats_booked:
            return Response(
                {"detail": "Недостатньо місць"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # заявка підтверджена, тепер можна оплачувати
        booking.status = "pending_payment"
        booking.save()

        return Response(
            {"message": "Заявку підтверджено"},
            status=status.HTTP_200_OK
        )

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        booking = self.get_object()

        # тільки водій цієї поїздки може відхилити
        if booking.trip.driver != request.user:
            return Response(
                {"detail": "Це не ваша поїздка"},
                status=status.HTTP_403_FORBIDDEN
            )

        if booking.status != "pending":
            return Response(
                {"detail": "Заявка вже оброблена"},
                status=status.HTTP_400_BAD_REQUEST
            )

        booking.status = "rejected"
        booking.save()

        return Response(
            {"message": "Заявку відхилено"},
            status=status.HTTP_200_OK
        )

    @action(detail=True, methods=["post"])
    def confirm_payment(self, request, pk=None):
        booking = self.get_object()

        # тільки пасажир цього бронювання може оплатити
        if booking.passenger != request.user:
            return Response(
                {"detail": "Це не ваше бронювання"},
                status=status.HTTP_403_FORBIDDEN
            )

        # оплачувати можна тільки після підтвердження водієм
        if booking.status != "pending_payment":
            return Response(
                {"detail": "Бронювання не очікує оплату"},
                status=status.HTTP_400_BAD_REQUEST
            )

        with transaction.atomic():
            trip = Trip.objects.select_for_update().get(pk=booking.trip.pk)

            if trip.seats_available < booking.seats_booked:
                return Response(
                    {"detail": "Недостатньо місць"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # місця списуються тільки після оплати
            trip.seats_available -= booking.seats_booked

            if trip.seats_available == 0:
                trip.status = "full"

            trip.save()

            booking.status = "approved"
            booking.save()

        return Response(
            {
                "message": "Оплата підтверджена",
                "booking_id": booking.id
            },
            status=status.HTTP_200_OK

        )


# ----------------------------------------
# CAR VIEWSET
# ----------------------------------------
class CarViewSet(viewsets.ModelViewSet):
    queryset = Car.objects.all()
    serializer_class = CarSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        if not self.request.user.is_driver:
            raise permissions.PermissionDenied("Тільки водії можуть додавати авто")
        serializer.save(driver=self.request.user)


# ----------------------------------------
# MESSAGE VIEWSET
# ----------------------------------------
class MessageViewSet(viewsets.ModelViewSet):
    queryset = Message.objects.all()
    serializer_class = MessageSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(sender=self.request.user)


# ----------------------------------------
# REVIEW VIEWSET
# ----------------------------------------
class ReviewViewSet(viewsets.ModelViewSet):
    queryset = Review.objects.select_related("trip", "reviewer", "reviewee").all()
    serializer_class = ReviewSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user

        # показуємо відгуки, де юзер або автор, або отримувач
        written = Review.objects.filter(reviewer=user)
        received = Review.objects.filter(reviewee=user)

        return (written | received).distinct()

    def perform_create(self, serializer):
        serializer.save(reviewer=self.request.user)

# ----------------------------------------
# CITIES AUTOCOMPLETE
# ----------------------------------------
@api_view(["GET"])
@permission_classes([AllowAny])
def cities(request):
    origins = Trip.objects.values_list("origin", flat=True).distinct()
    destinations = Trip.objects.values_list("destination", flat=True).distinct()
    return Response({"origins": list(origins), "destinations": list(destinations)}, status=status.HTTP_200_OK)

@api_view(["GET"])
@permission_classes([IsAdminUser])
def admin_users(request):
    users = User.objects.all().order_by("-date_joined")
    serializer = UserSerializer(users, many=True)
    return Response(serializer.data)


@api_view(["POST"])
@permission_classes([IsAdminUser])
def block_user(request, user_id):
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response({"detail": "Користувача не знайдено"}, status=404)

    user.is_blocked = True
    user.save(update_fields=["is_blocked"])
    return Response({"message": "Користувача заблоковано"})


@api_view(["POST"])
@permission_classes([IsAdminUser])
def unblock_user(request, user_id):
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response({"detail": "Користувача не знайдено"}, status=404)

    user.is_blocked = False
    user.save(update_fields=["is_blocked"])
    return Response({"message": "Користувача розблоковано"})


@api_view(["GET"])
@permission_classes([IsAdminUser])
def admin_reviews(request):
    reviews = Review.objects.select_related("trip", "reviewer", "reviewee").all().order_by("-created_at")
    serializer = ReviewSerializer(reviews, many=True)
    return Response(serializer.data)


@api_view(["POST"])
@permission_classes([IsAdminUser])
def hide_review(request, review_id):
    try:
        review = Review.objects.get(id=review_id)
    except Review.DoesNotExist:
        return Response({"detail": "Відгук не знайдено"}, status=404)

    review.is_hidden = True
    review.save(update_fields=["is_hidden"])
    return Response({"message": "Відгук приховано"})


@api_view(["POST"])
@permission_classes([IsAdminUser])
def show_review(request, review_id):
    try:
        review = Review.objects.get(id=review_id)
    except Review.DoesNotExist:
        return Response({"detail": "Відгук не знайдено"}, status=404)

    review.is_hidden = False
    review.save(update_fields=["is_hidden"])
    return Response({"message": "Відгук знову показується"})

# ----------------------------------------
# ADMIN: USERS
# ----------------------------------------
@api_view(["GET"])
@permission_classes([IsAdminUser])
def admin_users(request):
    users = User.objects.all().order_by("-date_joined")
    serializer = AdminUserSerializer(users, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([IsAdminUser])
def admin_block_user(request, user_id):
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response({"detail": "Користувача не знайдено"}, status=status.HTTP_404_NOT_FOUND)

    if user.is_superuser:
        return Response({"detail": "Не можна заблокувати суперкористувача"}, status=status.HTTP_400_BAD_REQUEST)

    user.is_blocked = True
    user.save(update_fields=["is_blocked"])
    return Response({"message": "Користувача заблоковано"}, status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([IsAdminUser])
def admin_unblock_user(request, user_id):
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response({"detail": "Користувача не знайдено"}, status=status.HTTP_404_NOT_FOUND)

    user.is_blocked = False
    user.save(update_fields=["is_blocked"])
    return Response({"message": "Користувача розблоковано"}, status=status.HTTP_200_OK)


# ----------------------------------------
# ADMIN: REVIEWS
# ----------------------------------------
@api_view(["GET"])
@permission_classes([IsAdminUser])
def admin_reviews(request):
    reviews = Review.objects.select_related("trip", "reviewer", "reviewee").all().order_by("-created_at")
    serializer = AdminReviewSerializer(reviews, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([IsAdminUser])
def admin_hide_review(request, review_id):
    try:
        review = Review.objects.get(id=review_id)
    except Review.DoesNotExist:
        return Response({"detail": "Відгук не знайдено"}, status=status.HTTP_404_NOT_FOUND)

    review.is_hidden = True
    review.save(update_fields=["is_hidden"])
    return Response({"message": "Відгук приховано"}, status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([IsAdminUser])
def admin_show_review(request, review_id):
    try:
        review = Review.objects.get(id=review_id)
    except Review.DoesNotExist:
        return Response({"detail": "Відгук не знайдено"}, status=status.HTTP_404_NOT_FOUND)

    review.is_hidden = False
    review.save(update_fields=["is_hidden"])
    return Response({"message": "Відгук знову відображається"}, status=status.HTTP_200_OK)