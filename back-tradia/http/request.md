⚠️ [NOTA]: Para que se realice la conversion se tiene que instalar un paquete en el servidor que se llama poppler-utils o yay poppler-utils


📘 API de Procesamiento de Documentos
🔵 Endpoints Principales
📤  Login con google

http://localhost:5000/api/auth/google

📤 POST - Logout con google
curl -X POST http://localhost:5000/api/auth/logout \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImNvcnRleC5hbmR5MjgwOUBnbWFpbC5jb20iLCJuYW1lIjoiQW5kcmVhIENvcnRleiBIZXJyZXJhIiwiaWF0IjoxNzQ1OTU4MjQ5LCJleHAiOjE3NDU5NjE4NDl9.Tglrb8UhMyf5L1EkvJbiTmcZiuOaxcwdTPUPpdQQ418"

📤 POST - Procesar documentos

curl -X POST \
  -F "pdf=@/home/cortexandy/Descargas/large.pdf" \
  -F "adapter=openai" \
  -F "prompt=quiero que me traduzcas a ingles el siguiente texto" \
  -F "language=en" \
  http://localhost:5000/api/process-document

📤 POST - Procesar imágenes

curl -X POST \
-F "pdf=@/home/cortexandy/Descargas/pagina-1.png" \
-F "adapter=openai" \
-F "prompt=quiero que me traduzcas a ingles el siguiente texto" \
-F "language=en" \
http://localhost:5000/api/process-document

🟦  adapter: Motor de procesamiento a utilizar (requerido)
🟦  prompt: Instrucciones específicas para el procesamiento (opcional)
🟦  language: Idioma de destino (ej. "en" para inglés) (requerido)
🟦  pdf/image: Archivo a procesar (requerido)


📤 POST -  Descargar Documento de un proceso
curl -X POST http://localhost:5000/api/download/91 \
  -H "Content-Type: application/json" \
  -d '{"type": "pdf | docx | html"}' \
  -O -J

🟡 Requiere el ID del proceso obtenido al subir el documento
🟡 Soporta múltiples formatos de salida:
🟡 pdf: Documento PDF estándar
🟡 docx: Documento Word editable
🟡 html: Código HTML con el contenido

Parámetros:

🟦 type: Formato de salida deseado (requerido)

⚠️ Monitoreo del proceso activo
Escuchar los eventos del proceso
curl http://localhost:5000/api/process-status/90

🟡 Requiere el ID del proceso obtenido al subir el documento

📤 POST -  Crear un proceso
curl -X POST -H "Content-Type: application/json" \
-d '{"name":"Proceso 1","description":"Descripción del proceso"}' \
http://localhost:5000/api/processes

📤 Obtener todos los procesos
curl http://localhost:5000/api/processes

📤  Obtener un proceso específico por ID
curl http://localhost:5000/api/processes/1

📤 Actualizar un proceso
curl -X PUT -H "Content-Type: application/json" \
-d '{"name":"Proceso Actualizado","description":"Nueva descripción"}' \
http://localhost:5000/api/processes/1

📤 PUT -  Actualizar solo el estado de un proceso
curl -X PUT -H "Content-Type: application/json" \
-d '{"status":"completed"}' \
http://localhost:5000/api/processes/1

📤 DELETE -  Eliminar un proceso
curl -X DELETE http://localhost:5000/api/processes/1



curl -X POST \
-F "html=/home/cortexandy/Descargas/conversion_html" \
-F "output=/home/cortexandy/Descargas/imagenes_finales" \
http://localhost:5000/api/convert-html-to-image