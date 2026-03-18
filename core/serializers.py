from rest_framework import serializers
from .models import User, Trip, Booking, Message, Review, Car
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth import authenticate


# ----------------------------------------
# USER
# ----------------------------------------

class UserSerializer(serializers.ModelSerializer):
    trips_as_passenger = serializers.SerializerMethodField()
    trips_as_driver = serializers.SerializerMethodField()
    reviews_count = serializers.SerializerMethodField()
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "first_name",
            "last_name",
            "phone_number",
            "avatar",
            "avatar_url",
            "rating",
            "is_driver",
            "trips_as_passenger",
            "trips_as_driver",
            "reviews_count",
        ]
        read_only_fields = [
            "email",
            "rating",
            "is_driver",
            "trips_as_passenger",
            "trips_as_driver",
            "reviews_count",
            "avatar_url",
        ]

    def get_trips_as_passenger(self, obj):
        return Booking.objects.filter(
            passenger=obj,
            status="approved"
        ).count()

    def get_trips_as_driver(self, obj):
        return Trip.objects.filter(driver=obj).count()

    def get_reviews_count(self, obj):
        return Review.objects.filter(reviewee=obj).count()

    def get_avatar_url(self, obj):
        request = self.context.get("request")
        if obj.avatar:
            if request:
                return request.build_absolute_uri(obj.avatar.url)
            return obj.avatar.url
        return None


class RegisterSerializer(serializers.ModelSerializer):
    password2 = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = (
            "email",
            "password",
            "password2",
            "first_name",
            "last_name",
            "phone_number",
        )
        extra_kwargs = {
            "password": {"write_only": True}
        }

    def validate(self, attrs):
        if attrs["password"] != attrs["password2"]:
            raise serializers.ValidationError(
                {"password": "Паролі не співпадають"}
            )

        if User.objects.filter(email=attrs["email"]).exists():
            raise serializers.ValidationError(
                {"email": "Ця пошта вже використовується"}
            )

        return attrs

    def create(self, validated_data):
        validated_data.pop("password2")

        user = User.objects.create_user(
            email=validated_data["email"],
            password=validated_data["password"],
            first_name=validated_data["first_name"],
            last_name=validated_data["last_name"],
            phone_number=validated_data["phone_number"],
        )
        return user


# ----------------------------------------
# CAR
# ----------------------------------------

class CarSerializer(serializers.ModelSerializer):
    class Meta:
        model = Car
        fields = "__all__"
        read_only_fields = ["driver"]


# ----------------------------------------
# TRIP
# ----------------------------------------

class TripSerializer(serializers.ModelSerializer):
    driver = UserSerializer(read_only=True)

    class Meta:
        model = Trip
        fields = "__all__"
        read_only_fields = ["driver", "status", "created_at", "seats_available"]


# ----------------------------------------
# BOOKING
# ----------------------------------------

class BookingSerializer(serializers.ModelSerializer):
    passenger = UserSerializer(read_only=True)

    # при створенні бронювання приймаємо trip як ID
    trip = serializers.PrimaryKeyRelatedField(
        queryset=Trip.objects.all(),
        write_only=True
    )

    # для фронтенду / checkout віддаємо повну поїздку
    trip_details = TripSerializer(source="trip", read_only=True)

    total_price = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Booking
        fields = [
            "id",
            "trip",
            "trip_details",
            "passenger",
            "seats_booked",
            "status",
            "booked_at",
            "total_price",
        ]
        read_only_fields = ["passenger", "status", "booked_at", "total_price"]

    def get_total_price(self, obj):
        try:
            return float(obj.trip.price_per_seat) * int(obj.seats_booked)
        except Exception:
            return None

    def validate(self, attrs):
        request = self.context["request"]
        trip = attrs["trip"]
        seats = int(attrs.get("seats_booked", 1))

        if seats <= 0:
            raise serializers.ValidationError({
                "seats_booked": "Має бути > 0"
            })

        if trip.driver_id == request.user.id:
            raise serializers.ValidationError({
                "trip": "Водій не може бронювати свою поїздку"
            })

        if trip.status in ("canceled", "completed"):
            raise serializers.ValidationError({
                "trip": "Поїздка недоступна"
            })

        if trip.seats_available < seats:
            raise serializers.ValidationError({
                "seats_booked": "Недостатньо місць"
            })

        return attrs

    def create(self, validated_data):
        request = self.context["request"]
        return Booking.objects.create(
            passenger=request.user,
            status="pending",
            **validated_data
        )


# ----------------------------------------
# MESSAGE
# ----------------------------------------

class MessageSerializer(serializers.ModelSerializer):
    sender = UserSerializer(read_only=True)

    class Meta:
        model = Message
        fields = "__all__"


# ----------------------------------------
# REVIEW
# ----------------------------------------

class ReviewSerializer(serializers.ModelSerializer):
    reviewer = UserSerializer(read_only=True)
    reviewee = serializers.PrimaryKeyRelatedField(queryset=User.objects.all())
    trip = serializers.PrimaryKeyRelatedField(queryset=Trip.objects.all())

    class Meta:
        model = Review
        fields = "__all__"
        read_only_fields = ["reviewer", "created_at"]

    def validate(self, attrs):
        request = self.context["request"]
        reviewer = request.user
        reviewee = attrs["reviewee"]
        trip = attrs["trip"]

        if reviewer == reviewee:
            raise serializers.ValidationError("Не можна залишити відгук самому собі")

        return attrs

    def create(self, validated_data):
        return Review.objects.create(**validated_data)


# ----------------------------------------
# LOGIN JWT
# ----------------------------------------

class EmailTokenObtainPairSerializer(TokenObtainPairSerializer):
    username_field = "email"

    def validate(self, attrs):
        email = attrs.get("email")
        password = attrs.get("password")

        user = authenticate(
            request=self.context.get("request"),
            email=email,
            password=password
        )

        if not user:
            raise serializers.ValidationError("Невірна пошта або пароль")

        data = super().validate({
            self.username_field: email,
            "password": password
        })

        data["user"] = {
            "id": user.id,
            "email": user.email,
            "full_name": f"{user.first_name} {user.last_name}",
            "is_driver": user.is_driver,
        }

        return data


# ----------------------------------------
# CURRENT USER / ME
# ----------------------------------------

class MeSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "email", "first_name", "last_name", "is_driver"]