from django.contrib import admin
from .models import WhatsAppGroup

@admin.register(WhatsAppGroup)
class WhatsAppGroupAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'whatsapp_id')
    search_fields = ('nombre',)