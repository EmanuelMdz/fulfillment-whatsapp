# Extensiones

La instalación inicial contiene el motor de mensajes, leads y seguimientos.
No muestra interruptores de funciones que todavía no están implementadas.

Para agregar una capacidad real, declarala en MODULES, guardá su activación en
la tabla modules y conectá su pantalla y su ejecución a esa bandera.
Un módulo apagado no debe ejecutar su lógica ni pedir claves.
Conservá los datos al apagarlo; no borres carpetas ni tablas.

El código de catálogo y pedidos anterior queda como referencia para quien quiera
construir una extensión comercial. Integraciones de agenda, pagos, audios o
imágenes requieren su implementación y pruebas; no se activan escribiendo un prompt.

Los módulos dependen del núcleo. Si comparten infraestructura, va al núcleo;
ninguno debe exigir que otro módulo esté activo.
