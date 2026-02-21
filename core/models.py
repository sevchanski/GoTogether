from django.db import models
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from django.utils import timezone


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

    is_driver = models.BooleanField(default=False)  # ✅ НОВЕ

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
    plate_number = models.CharField(max_length=20)
    color = models.CharField(max_length=50)

    def __str__(self):
        return f"{self.brand} {self.model} ({self.plate_number})"


# ----------------------------------------
# TRIP (міський райдшерінг)
# ----------------------------------------

class Trip(models.Model):
    driver = models.ForeignKey(User, on_delete=models.CASCADE, related_name='driven_trips')

    origin = models.CharField(max_length=255)
    destination = models.CharField(max_length=255)

    origin_lat = models.FloatField(null=True, blank=True)
    origin_lng = models.FloatField(null=True, blank=True)
    destination_lat = models.FloatField(null=True, blank=True)
    destination_lng = models.FloatField(null=True, blank=True)

    departure_time = models.DateTimeField()

    seats_total = models.PositiveIntegerField(default=1)
    seats_available = models.PositiveIntegerField(default=1)

    price_per_seat = models.DecimalField(max_digits=6, decimal_places=2)

    STATUS_CHOICES = (
        ('active', 'Active'),
        ('full', 'Full'),
        ('completed', 'Completed'),
        ('canceled', 'Canceled'),
    )

    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='active')

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.origin} → {self.destination}"


# ----------------------------------------
# BOOKING (заявка пасажира)
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

    def __str__(self):
        return f"{self.reviewer} ({self.rating}⭐)"