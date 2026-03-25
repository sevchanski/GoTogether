from django.db import models
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from django.utils import timezone
from django.core.exceptions import ValidationError
from django.db.models import Avg
from decimal import Decimal


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
    rating = models.DecimalField(max_digits=3, decimal_places=2, default=Decimal("5.00"))

    is_driver = models.BooleanField(default=False)
    is_blocked = models.BooleanField(default=False)
    date_joined = models.DateTimeField(default=timezone.now)
    last_login = models.DateTimeField(blank=True, null=True)

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['first_name', 'last_name']

    def __str__(self):
        return f"{self.first_name} {self.last_name}".strip() or self.email


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
    driver = models.ForeignKey(User, on_delete=models.CASCADE, related_name="driven_trips")

    # ✅ Місто (для фільтрів + обмеження пошуку адрес)
    city = models.CharField(max_length=100, default="Kyiv", db_index=True)

    origin = models.CharField(max_length=255, db_index=True)
    destination = models.CharField(max_length=255, db_index=True)

    # ✅ Координати залишаємо nullable (бо на старті можуть бути відсутні)
    origin_lat = models.FloatField(null=True, blank=True)
    origin_lng = models.FloatField(null=True, blank=True)
    destination_lat = models.FloatField(null=True, blank=True)
    destination_lng = models.FloatField(null=True, blank=True)

    # GeoJSON/Polyline маршруту
    route_geometry = models.JSONField(null=True, blank=True)

    # ✅ ДОДАЛИ: текстова “коротка” версія маршруту для пошуку по вулицях
    # сюди зберігай щось типу: "Хрещатик, Саксаганського, ... (без індексів/областей)"
    route_summary = models.TextField(blank=True, default="", db_index=True)

    distance_km = models.FloatField(null=True, blank=True)
    duration_min = models.IntegerField(null=True, blank=True)

    departure_time = models.DateTimeField(db_index=True)

    seats_total = models.PositiveIntegerField(default=1)
    seats_available = models.PositiveIntegerField(default=1)

    price_per_seat = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal("0.00"))

    STATUS_CHOICES = (
        ("active", "Active"),
        ("full", "Full"),
        ("completed", "Completed"),
        ("canceled", "Canceled"),
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="active", db_index=True)

    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        # ✅ при створенні синхронізуємо seats_available
        if not self.pk:
            self.seats_available = self.seats_total
        super().save(*args, **kwargs)

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
        ('pending_payment', 'Pending payment'),
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('canceled', 'Canceled'),
    )

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending_payment'
    )

    booked_at = models.DateTimeField(auto_now_add=True)

    def clean(self):
        if self.trip.driver == self.passenger:
            raise ValidationError("Водій не може бронювати свою поїздку")
        if self.seats_booked <= 0:
            raise ValidationError("Кількість місць має бути більше 0")

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

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
    trip = models.ForeignKey(
        Trip,
        on_delete=models.CASCADE,
        related_name='reviews'
    )

    reviewer = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='reviews_written'
    )

    reviewee = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='reviews_received'
    )

    rating = models.PositiveSmallIntegerField(default=5)
    comment = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    is_blocked = models.BooleanField(default=False)
    is_hidden = models.BooleanField(default=False)
    is_approved = models.BooleanField(default=True)

    class Meta:
        unique_together = ("trip", "reviewer", "reviewee")

    def clean(self):
        if self.reviewer == self.reviewee:
            raise ValidationError("Не можна залишати відгук самому собі")

        if self.trip.status != "completed":
            raise ValidationError("Відгук можна залишити лише після завершення поїздки")

        # учасники поїздки:
        # водій + пасажири з approved бронюванням
        approved_passengers = list(
            User.objects.filter(
                bookings__trip=self.trip,
                bookings__status="approved"
            ).distinct()
        )

        participants = approved_passengers + [self.trip.driver]

        if self.reviewer not in participants:
            raise ValidationError("Ви не є учасником цієї поїздки")

        if self.reviewee not in participants:
            raise ValidationError("Цей користувач не є учасником цієї поїздки")

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

        avg_rating = Review.objects.filter(
            reviewee=self.reviewee
        ).aggregate(Avg('rating'))['rating__avg']

        if avg_rating is not None:
            self.reviewee.rating = Decimal(str(round(avg_rating, 2)))
            self.reviewee.save(update_fields=["rating"])

    def __str__(self):
        return f"{self.reviewer} -> {self.reviewee} ({self.rating}⭐)"