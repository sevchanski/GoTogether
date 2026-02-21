from rest_framework import serializers
from .models import User, Trip, Booking, Message, Review
from django.contrib.auth.password_validation import validate_password
from django.utils import timezone
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth import authenticate



# ----------------------------------------
# 1. Користувач
# ----------------------------------------
class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'phone_number', 'avatar', 'rating']

class UserRegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    is_driver = serializers.BooleanField(default=False)  # нове поле для ролі

    class Meta:
        model = User
        fields = ['email', 'password', 'phone_number', 'avatar']

    def create(self, validated_data):
        user = User(
            email=validated_data['email'],
            phone_number=validated_data.get('phone_number', ''),
            avatar=validated_data.get('avatar', None),
            is_driver=validated_data.get('is_driver', False)
        )
        user.set_password(validated_data['password'])
        user.save()
        return user
# ----------------------------------------
# 2. Поїздка
# ----------------------------------------
class TripSerializer(serializers.ModelSerializer):
    driver = UserSerializer(read_only=True)
    status = serializers.CharField(read_only=True)  # planned, completed, canceled

    class Meta:
        model = Trip
        fields = '__all__'
        read_only_fields = ['driver', 'created_at', 'seats_available', 'status']

# ----------------------------------------
# 3. Бронювання
# ----------------------------------------
class BookingSerializer(serializers.ModelSerializer):
    passenger = UserSerializer(read_only=True)
    trip = TripSerializer(read_only=True)

    class Meta:
        model = Booking
        fields = '__all__'
        read_only_fields = ['passenger', 'booked_at']

    def create(self, validated_data):
        booking = super().create(validated_data)
        # Зменшуємо кількість доступних місць
        trip = booking.trip
        trip.seats_available -= booking.seats_booked
        trip.save()
        return booking

# ----------------------------------------
# 4. Повідомлення
# ----------------------------------------
class MessageSerializer(serializers.ModelSerializer):
    sender = UserSerializer(read_only=True)

    class Meta:
        model = Message
        fields = '__all__'

# ----------------------------------------
# 5. Відгуки
# ----------------------------------------
class ReviewSerializer(serializers.ModelSerializer):
    reviewer = UserSerializer(read_only=True)

    class Meta:
        model = Review
        fields = '__all__'

class RegisterSerializer(serializers.ModelSerializer):
    password2 = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ('email', 'password', 'password2', 'first_name', 'last_name', 'phone_number', 'avatar')
        extra_kwargs = {
            'password': {'write_only': True, 'validators': [validate_password]},
        }

    def validate(self, attrs):
        if attrs['password'] != attrs['password2']:
            raise serializers.ValidationError({"non_field_errors": ["Паролі не співпадають"]})
        if User.objects.filter(email=attrs['email']).exists():
            raise serializers.ValidationError({"email": ["Ця пошта вже використовується"]})
        return attrs

    def create(self, validated_data):
        validated_data.pop('password2')  # видаляємо повторний пароль
        user = User.objects.create_user(
            email=validated_data['email'],
            password=validated_data['password'],
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),

        )
        return user

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
            "first_name": user.first_name,
            "last_name": user.last_name,
        }

        return data