import os
import requests
from PyPDF2 import PdfReader
from django.conf import settings
from django.shortcuts import render
from django.http import JsonResponse
from django.core.files.storage import default_storage
from PyPDF2 import PdfReader
import re
import pandas as pd
from time import sleep
from .models import WhatsAppGroup

def dashboard_view(request):

    if request.method == 'GET':
        return render(request, 'dashboard.html', {
        'title': 'SPVGA'
    })

    if request.method == 'POST':
        print("POST request received in dashboard_view")
        # Obtener campos del formulario
        phone = request.POST.get('phone')
        pdf_file = request.FILES.get('inscription')

        if not phone or not pdf_file:
            return JsonResponse({'status': 'error', 'mensaje': 'Faltan datos del formulario.'})

        # Guardar temporalmente el PDF
        pdf_path = default_storage.save(f'temp/{pdf_file.name}', pdf_file)
        full_pdf_path = os.path.join(settings.MEDIA_ROOT, pdf_path)

        try:

            reader = PdfReader(full_pdf_path)
            text = reader.pages[0].extract_text()
            # \d{1,2}\w{1}[M,V]\d{1,2} quiero que me hagas split de esto
            pattern = r'\d{1,2}\w{1}[MV]\d{1,2}'

            resultado = re.split(pattern, text)

            # obtener el texto que coincide con el patrón
            matches = re.findall(pattern, text)

            # quita el primer elemento que es el texto antes del primer match
            resultado = resultado[1:]
            # al ultimo item hago split por NOTA
            ultimo_item = resultado[-1]
            resultado[-1] = ultimo_item.split("NOTA")[0].strip()
            # crea un DataFrame de pandas con las columnas Grupo | Materia | Profesor | Horario
            horarios = pd.DataFrame(columns=["Grupo", "Materia", "Profesor", "Horario"])

            for i, item in enumerate(resultado):
                item = item.strip()
                partes = item.split("-")
                # seleccionar el elemento 1
                if len(partes) > 1:
                    content = partes[1].strip()
                    # hacer split a content donde se cumpla la regex de \d{1,2}.\d{1,2}
                    materia = re.split(r'\d{1,2}\.\d{1,3}', content)[0].strip()
                    profesor = re.split(r'\d{1,2}\.\d{1,3}', content)[1].strip()
                    # a profesor quitar cualqioer numero 
                    profesor = re.sub(r'\d+', '', profesor).strip()
                    # quitar dos puntos al final de profesor si existen
                    if profesor.endswith(":"):
                        profesor = profesor[:-1].strip()
                # de item trae los matches de la regex \d{2}:\d{2}\s*-\s*\d{2}:\d{2}
                horarios_materia = re.findall(r'\d{2}:\d{2}\s*-\s*\d{2}:\d{2}', item)

                horarios = pd.concat([horarios, pd.DataFrame({"Grupo": [matches[0].strip()], "Materia": [materia], "Profesor": [profesor], "Horario": [horarios_materia]})], ignore_index=True)

        except Exception as e:
            return JsonResponse({'status': 'error', 'mensaje': f'Error leyendo PDF: {str(e)}'})
        
        # seleccionar solo un registro para prueba
        horarios = horarios.head(1)

        try:
            for group in horarios.itertuples(index=False):
                group_name = f"{group.Grupo} - {group.Materia}"
                description = f"*Grupo:* {group.Grupo}\n*Materia:* {group.Materia}\n*Profesor:* {group.Profesor}\n*Horario:* {', '.join(group.Horario)}"
                alumno = f"52{phone}"
                
                # 1) ¿Ya existe este grupo en BD?
                wa_group, creado = WhatsAppGroup.objects.get_or_create(
                    nombre=group_name,
                    defaults={'whatsapp_id': None}
                )

                if creado or not wa_group.whatsapp_id:
                    # a) Lo creamos en WhatsApp
                    payload = {
                        'nombre_grupo': group_name,
                        'miembros': [alumno],
                        'descripcion': description,
                    }
                    res = requests.post('http://localhost:3000/crear_grupo', json=payload)
                    data = res.json()
                    print("Response from WhatsApp API:", data)

                    if data.get('status') == 'ok' and data.get('group_id'):
                        wa_group.nombre = group_name
                        wa_group.whatsapp_id = data.get('group_id')
                        print(f"Grupo creado: {wa_group.nombre} con ID {wa_group.whatsapp_id}")
                        wa_group.save()
                    else:
                        print(f"Error al crear grupo: {data.get('mensaje', 'No se pudo crear el grupo')}")
                        # manejar error...
                        continue
                else:
                    print(f"Grupo ya existe: {wa_group.nombre} con ID {wa_group.whatsapp_id}")
                    # b) Ya existe: agregamos solo al alumno
                    payload = {
                        'group_id': wa_group.whatsapp_id,
                        'miembros': [alumno],
                    }
                    requests.post('http://localhost:3000/agregar_participantes', json=payload)

            # … limpieza de PDF …
            if default_storage.exists(pdf_path):
                default_storage.delete(pdf_path)
            return JsonResponse({'status':'ok'})
        except Exception as e:
            print(f"Error procesando grupos: {str(e)}")
            if default_storage.exists(pdf_path):
                default_storage.delete(pdf_path)
            return JsonResponse({'status':'error','mensaje':str(e)})

    return render(request, 'dashboard.html')