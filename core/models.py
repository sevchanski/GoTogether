from django.db import models
from django.contrib.auth.models import AbstractBaseUser, Group, PermissionsMixin,BaseUserManager
from django.utils import timezone


# ----------------------------------------
# 1. Користувач / профіль
# ----------------------------------------
class UserManager(BaseUserManager):
    def create_user(self, email, password=None, first_name='', last_name='', **extra_fields):
        if not email:
            raise ValueError("Email обов'язковий")

        email = self.normalize_email(email)

        user = self.model(
            email=email,
            first_name=first_name,
            last_name=last_name,
            **extra_fields
        )
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password, first_name='', last_name='', **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)

        return self.create_user(email, password, first_name, last_name, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    email = models.EmailField(unique=True)

    first_name = models.CharField(max_length=150)
    last_name = models.CharField(max_length=150)

    phone_number = models.CharField(max_length=20, blank=True)
    avatar = models.ImageField(upload_to='avatars/', blank=True, null=True)
    rating = models.DecimalField(max_digits=3, decimal_places=2, default=5.0)

    date_joined = models.DateTimeField(default=timezone.now)  # ✅ ОБОВʼЯЗКОВО
    last_login = models.DateTimeField(blank=True, null=True)  # (рекомендовано)

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['first_name', 'last_name']

    def __str__(self):
        return f"{self.first_name} {self.last_name}"

# ----------------------------------------
# 2. Поїздки
# ----------------------------------------
class Trip(models.Model):
    driver = models.ForeignKey(User, on_delete=models.CASCADE, related_name='driven_trips')
    title = models.CharField(max_length=200, blank=True)
    origin = models.CharField(max_length=255)
    destination = models.CharField(max_length=255)
    departure_time = models.DateTimeField()
    seats_total = models.PositiveIntegerField(default=1)
    seats_available = models.PositiveIntegerField(default=1)
    price = models.DecimalField(max_digits=8, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.origin} → {self.destination} @ {self.departure_time}"


# ----------------------------------------
# 3. Бронювання
# ----------------------------------------
class Booking(models.Model):
    trip = models.ForeignKey(Trip, on_delete=models.CASCADE, related_name='bookings')
    passenger = models.ForeignKey(User, on_delete=models.CASCADE, related_name='bookings')
    seats_booked = models.PositiveIntegerField(default=1)
    booked_at = models.DateTimeField(auto_now_add=True)

    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('confirmed', 'Confirmed'),
        ('canceled', 'Canceled'),
    )
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')

    def __str__(self):
        return f"{self.passenger} -> {self.trip}"


# ----------------------------------------
# 4. Повідомлення / чат
# ----------------------------------------
class Message(models.Model):
    trip = models.ForeignKey(Trip, on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey(User, on_delete=models.CASCADE)
    content = models.TextField()
    timestamp = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return f"{self.sender}: {self.content[:30]}..."


# ----------------------------------------
# 5. Відгуки
# ----------------------------------------
class Review(models.Model):
    trip = models.ForeignKey(Trip, on_delete=models.CASCADE, related_name='reviews')
    reviewer = models.ForeignKey(User, on_delete=models.CASCADE, related_name='reviews_written')
    rating = models.PositiveSmallIntegerField(default=5)  # 1-5 зірок
    comment = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.reviewer} -> {self.trip} ({self.rating}⭐)"
