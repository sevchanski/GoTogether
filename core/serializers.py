from rest_framework import serializers
from .models import User, Trip, Booking, Message, Review
from django.contrib.auth.password_validation import validate_password


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
        fields = ['username', 'email', 'password', 'phone_number', 'avatar']

    def create(self, validated_data):
        user = User(
            username=validated_data['username'],
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
    password = serializers.CharField(write_only=True, validators=[validate_password])
    password2 = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ('username', 'email', 'password', 'password2')

    def validate(self, attrs):
        if attrs['password'] != attrs['password2']:
            raise serializers.ValidationError("Паролі не співпадають")
        return attrs

    def create(self, validated_data):
        validated_data.pop('password2')
        user = User.objects.create_user(**validated_data)
        return user