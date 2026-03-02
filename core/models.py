from django.db import models
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from django.utils import timezone
from django.core.exceptions import ValidationError
from django.db.models import Avg


# ----------------------------------------
# USER
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

    is_driver = models.BooleanField(default=False)

    date_joined = models.DateTimeField(default=timezone.now)
    last_login = models.DateTimeField(blank=True, null=True)

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['first_name', 'last_name']

    def __str__(self):
        return f"{self.first_name} {self.last_name}"


# ----------------------------------------
# CAR
# ----------------------------------------

class Car(models.Model):
    driver = models.OneToOneField(User, on_delete=models.CASCADE, related_name='car')
    brand = models.CharField(max_length=100)
    model = models.CharField(max_length=100)
    plate_number = models.CharField(max_length=20, unique=True)
    color = models.CharField(max_length=50)

    def __str__(self):
        return f"{self.brand} {self.model} ({self.plate_number})"


# ----------------------------------------
# TRIP
# ----------------------------------------
class Trip(models.Model):
    driver = models.ForeignKey(User, on_delete=models.CASCADE)

    city = models.CharField(max_length=100)

    origin = models.CharField(max_length=255)
    origin_lat = models.FloatField()
    origin_lng = models.FloatField()

    destination = models.CharField(max_length=255)
    destination_lat = models.FloatField()
    destination_lng = models.FloatField()

    route_geometry = models.JSONField(null=True, blank=True)

    distance_km = models.FloatField(null=True, blank=True)
    duration_min = models.IntegerField(null=True, blank=True)

    departure_time = models.DateTimeField()

    seats_total = models.IntegerField()
    seats_available = models.IntegerField()

    price_per_seat = models.DecimalField(max_digits=8, decimal_places=2)

    status = models.CharField(max_length=20, default="active")

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.origin} → {self.destination}"


# ----------------------------------------
# BOOKING
# ----------------------------------------

class Booking(models.Model):
    trip = models.ForeignKey(Trip, on_delete=models.CASCADE, related_name='bookings')
    passenger = models.ForeignKey(User, on_delete=models.CASCADE, related_name='bookings')

    seats_booked = models.PositiveIntegerField(default=1)

    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('canceled', 'Canceled'),
    )

    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')
    booked_at = models.DateTimeField(auto_now_add=True)

    def clean(self):
        # ❌ Водій не може бронювати свою поїздку
        if self.trip.driver == self.passenger:
            raise ValidationError("Водій не може бронювати свою поїздку")

        if self.seats_booked <= 0:
            raise ValidationError("Кількість місць має бути більше 0")

    def __str__(self):
        return f"{self.passenger} -> {self.trip}"


# ----------------------------------------
# MESSAGE
# ----------------------------------------

class Message(models.Model):
    trip = models.ForeignKey(Trip, on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey(User, on_delete=models.CASCADE)
    content = models.TextField()
    timestamp = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return f"{self.sender}: {self.content[:30]}..."


# ----------------------------------------
# REVIEW
# ----------------------------------------

class Review(models.Model):
    trip = models.ForeignKey(Trip, on_delete=models.CASCADE, related_name='reviews')
    reviewer = models.ForeignKey(User, on_delete=models.CASCADE, related_name='reviews_written')
    rating = models.PositiveSmallIntegerField(default=5)
    comment = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)

        # 🔥 Автоматичне оновлення рейтингу водія
        driver = self.trip.driver
        avg_rating = Review.objects.filter(trip__driver=driver).aggregate(Avg('rating'))['rating__avg']
        driver.rating = round(avg_rating, 2)
        driver.save()

    def __str__(self):
        return f"{self.reviewer} ({self.rating}⭐)"