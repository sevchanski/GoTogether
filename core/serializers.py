from rest_framework import serializers
from .models import User, Trip, Booking, Message, Review, Car
from django.contrib.auth.password_validation import validate_password
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth import authenticate


# ----------------------------------------
# USER
# ----------------------------------------

class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'email', 'full_name', 'phone_number', 'avatar', 'rating', 'is_driver']

    def get_full_name(self, obj):
        return f"{obj.first_name} {obj.last_name}"


class RegisterSerializer(serializers.ModelSerializer):
    password2 = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = (
            'email',
            'password',
            'password2',
            'first_name',
            'last_name',
            'phone_number',
        )
        extra_kwargs = {
            'password': {'write_only': True}
        }

    def validate(self, attrs):
        if attrs['password'] != attrs['password2']:
            raise serializers.ValidationError(
                {"password": "Паролі не співпадають"}
            )

        if User.objects.filter(email=attrs['email']).exists():
            raise serializers.ValidationError(
                {"email": "Ця пошта вже використовується"}
            )

        return attrs

    def create(self, validated_data):
        validated_data.pop('password2')

        user = User.objects.create_user(
            email=validated_data['email'],
            password=validated_data['password'],
            first_name=validated_data['first_name'],
            last_name=validated_data['last_name'],
            phone_number=validated_data['phone_number'],
        )

        return user

# ----------------------------------------
# CAR
# ----------------------------------------

class CarSerializer(serializers.ModelSerializer):
    class Meta:
        model = Car
        fields = '__all__'
        read_only_fields = ['driver']


# ----------------------------------------
# TRIP (створює водій)
# ----------------------------------------

class TripSerializer(serializers.ModelSerializer):
    driver = UserSerializer(read_only=True)

    class Meta:
        model = Trip
        fields = '__all__'
        read_only_fields = ['driver', 'status', 'created_at', 'seats_available']


# ----------------------------------------
# BOOKING (заявка пасажира)
# ----------------------------------------

class BookingSerializer(serializers.ModelSerializer):
    passenger = UserSerializer(read_only=True)
    trip = TripSerializer(read_only=True)

    class Meta:
        model = Booking
        fields = '__all__'
        read_only_fields = ['passenger', 'status', 'booked_at']

    def create(self, validated_data):
        """
        Створюємо заявку.
        Місця НЕ зменшуємо тут.
        Водій повинен підтвердити.
        """
        return super().create(validated_data)


# ----------------------------------------
# MESSAGE
# ----------------------------------------

class MessageSerializer(serializers.ModelSerializer):
    sender = UserSerializer(read_only=True)

    class Meta:
        model = Message
        fields = '__all__'


# ----------------------------------------
# REVIEW
# ----------------------------------------

class ReviewSerializer(serializers.ModelSerializer):
    reviewer = UserSerializer(read_only=True)

    class Meta:
        model = Review
        fields = '__all__'


# ----------------------------------------
# LOGIN JWT
# ----------------------------------------

class EmailTokenObtainPairSerializer(TokenObtainPairSerializer):
    username_field = 'email'

    def validate(self, attrs):
        email = attrs.get("email")
        password = attrs.get("password")

        user = authenticate(
            request=self.context.get('request'),
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
# serializers.py

class MeSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'email', 'first_name', 'last_name', 'is_driver']