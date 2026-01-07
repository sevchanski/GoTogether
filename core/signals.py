from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from .models import Trip, Booking, Review, User  # .models, бо сигнали в тій же папці
