from django.shortcuts import render
from rest_framework import viewsets, permissions
from rest_framework.decorators import api_view
from rest_framework.response import Response
from .models import User, Trip, Booking, Message, Review
from .serializers import UserSerializer, TripSerializer, BookingSerializer, MessageSerializer, ReviewSerializer
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets, filters
from .models import Trip
from .serializers import TripSerializer
from .filters import TripFilter  # <- наш кастомний FilterSet
from rest_framework.permissions import IsAuthenticatedOrReadOnly
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework import status
from .serializers import UserRegisterSerializer
from django.shortcuts import render, redirect
from django.contrib.auth import authenticate, login, logout
from django.contrib import messages
from .serializers import UserSerializer
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from .models import User
from .serializers import RegisterSerializer

# ----------------------------------------
# 1. Головна сторінка
# ----------------------------------------
def home(request):
    return render(request, 'core/home.html')


# ----------------------------------------
# 2. ViewSets для REST API
# ----------------------------------------

class TripViewSet(viewsets.ModelViewSet):
    """
    CRUD для поїздок (Trip) з фільтрами, пошуком і сортуванням
    """
    queryset = Trip.objects.all().order_by('departure_time')
    serializer_class = TripSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]

    # ------------------------
    # Фільтри та пошук
    # ------------------------
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = TripFilter      # підтримка фільтра по даті
    search_fields = ['origin', 'destination']  # пошук за містами
    ordering_fields = ['departure_time', 'price']  # сортування
    ordering = ['departure_time']  # сортування за замовчуванням

    # ------------------------
    # Створення поїздки
    # ------------------------
    def perform_create(self, serializer):
        """
        Встановлюємо водія як поточного користувача
        """
        serializer.save(driver=self.request.user)

class BookingViewSet(viewsets.ModelViewSet):
    """
    CRUD для бронювань (Booking)
    """
    queryset = Booking.objects.all()
    serializer_class = BookingSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        # Встановлюємо пасажира як поточного користувача
        serializer.save(passenger=self.request.user)


class MessageViewSet(viewsets.ModelViewSet):
    """
    CRUD для повідомлень (Message)
    """
    queryset = Message.objects.all()
    serializer_class = MessageSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        # Встановлюємо відправника як поточного користувача
        serializer.save(sender=self.request.user)


class ReviewViewSet(viewsets.ModelViewSet):
    """
    CRUD для відгуків (Review)
    """
    queryset = Review.objects.all()
    serializer_class = ReviewSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        # Встановлюємо автора відгуку як поточного користувача
        serializer.save(reviewer=self.request.user)


# ----------------------------------------
# 3. Ендпойнт для автокомпліту міст
# ----------------------------------------
@api_view(['GET'])
@permission_classes([AllowAny])  # <- Дозволяємо доступ без логіну
def cities(request):
    origins = Trip.objects.values_list('origin', flat=True).distinct()
    destinations = Trip.objects.values_list('destination', flat=True).distinct()
    return Response({
        'origins': list(origins),
        'destinations': list(destinations)
    })
@api_view(['POST'])
@permission_classes([AllowAny])
def register(request):
    serializer = UserRegisterSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response({'message': 'User registered successfully'}, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

def register_view(request):
    if request.method == 'POST':
        username = request.POST.get('username')
        email = request.POST.get('email')
        password = request.POST.get('password')

        if User.objects.filter(username=username).exists():
            messages.error(request, 'Користувач з таким ім\'ям вже існує!')
            return redirect('register')

        user = User.objects.create_user(username=username, email=email, password=password)
        login(request, user)
        return redirect('home')

    return render(request, 'core/register.html')


# ----------------------------------------
# Сторінка логіну
# ----------------------------------------
def login_view(request):
    if request.method == 'POST':
        username = request.POST.get('username')
        password = request.POST.get('password')
        user = authenticate(request, username=username, password=password)
        if user:
            login(request, user)
            return redirect('home')
        else:
            messages.error(request, 'Неправильний логін або пароль')
            return redirect('login')
    return render(request, 'core/login.html')


# ----------------------------------------
# Вихід
# ----------------------------------------
def logout_view(request):
    logout(request)
    return redirect('home')

@api_view(['POST'])
@permission_classes([AllowAny])
def register(request):
    serializer = RegisterSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response({"message": "Користувач створений"}, status=201)
    return Response(serializer.errors, status=400)
