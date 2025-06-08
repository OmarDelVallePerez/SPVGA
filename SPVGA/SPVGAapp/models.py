from django.db import models

class WhatsAppGroup(models.Model):
    nombre = models.CharField(max_length=100, unique=True)
    whatsapp_id = models.CharField(max_length=50)

    def __str__(self):
        return f"{self.nombre} ({self.whatsapp_id})"
