from rest_framework import viewsets, permissions, status, filters
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.permissions import IsAuthenticatedOrReadOnly, AllowAny, IsAuthenticated
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import Trip, Booking, Message, Review, Car
from .serializers import (
    UserSerializer,
    TripSerializer,
    BookingSerializer,
    MessageSerializer,
    ReviewSerializer,
    CarSerializer,
    RegisterSerializer,
    EmailTokenObtainPairSerializer,
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
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me(request):
    # Повертаємо дані залогіненого користувача
    serializer = UserSerializer(request.user)
    return Response(serializer.data, status=status.HTTP_200_OK)


# ----------------------------------------
# TRIP VIEWSET (ПОЇЗДКИ)
# ----------------------------------------
class TripViewSet(viewsets.ModelViewSet):
    queryset = Trip.objects.all().order_by("departure_time")
    serializer_class = TripSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]

    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = TripFilter
    search_fields = ["origin", "destination"]
    ordering_fields = ["departure_time", "price_per_seat"]
    ordering = ["departure_time"]

    def perform_create(self, serializer):
        # тільки водій може створювати поїздки
        if not self.request.user.is_driver:
            raise permissions.PermissionDenied("Тільки водії можуть створювати поїздки")
        serializer.save(driver=self.request.user)

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        trip = self.get_object()

        if trip.driver != request.user:
            return Response({"error": "Ви не водій цієї поїздки"}, status=status.HTTP_403_FORBIDDEN)

        trip.status = "completed"
        trip.save()
        return Response({"message": "Поїздку завершено"}, status=status.HTTP_200_OK)


# ----------------------------------------
# BOOKING VIEWSET
# ----------------------------------------
class BookingViewSet(viewsets.ModelViewSet):
    queryset = Booking.objects.all()
    serializer_class = BookingSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(passenger=self.request.user)

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        booking = self.get_object()

        if booking.trip.driver != request.user:
            return Response({"error": "Ви не водій цієї поїздки"}, status=status.HTTP_403_FORBIDDEN)

        if booking.trip.seats_available < booking.seats_booked:
            return Response({"error": "Недостатньо місць"}, status=status.HTTP_400_BAD_REQUEST)

        booking.status = "approved"
        booking.save()

        trip = booking.trip
        trip.seats_available -= booking.seats_booked
        if trip.seats_available == 0:
            trip.status = "full"
        trip.save()

        return Response({"message": "Бронювання підтверджено"}, status=status.HTTP_200_OK)
    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        booking = self.get_object()

        if booking.trip.driver != request.user:
            return Response({"error": "Ви не водій цієї поїздки"}, status=status.HTTP_403_FORBIDDEN)

        booking.status = "rejected"
        booking.save()
        return Response({"message": "Бронювання відхилено"}, status=status.HTTP_200_OK)


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
    queryset = Review.objects.all()
    serializer_class = ReviewSerializer
    permission_classes = [IsAuthenticated]

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