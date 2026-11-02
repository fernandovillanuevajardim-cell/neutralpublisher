# Control de pantallas

## Activacion

1. Ejecutar `backend/supabase/display-control.sql` en el proyecto configurado, despues de `schema.sql`.
2. Desplegar esta version de la web. No desplegar primero: los visores con empresa se detienen si falta la funcion SQL.
3. Abrir el enlace del visor generado para una empresa (`#/display?org=...`) en cada pantalla.
4. En Admin > Pantallas, actualizar y autorizar el codigo que aparece en la TV. Renombrarlo, por ejemplo, `Sucursal Centro - Caja`.

Solo owner/admin de la misma organizacion pueden consultar o cambiar pantallas. Los editores no tienen ese permiso.

## Funcionamiento y consumo

- Una identidad por navegador/perfil y organizacion, persistida en localStorage. Dos pestanas del mismo perfil cuentan como una pantalla registrada, no como dos sesiones.
- La clave aleatoria de 256 bits no viaja en enlaces; la base guarda solo su hash SHA-256.
- El primer registro siempre queda pendiente. Borrar datos del navegador crea otra solicitud pendiente; no concede autorizacion.
- El visor comprueba el estado cada 5 minutos, con timeout de 15 segundos, sin consultas superpuestas. Aproximadamente 288 consultas por dia de uso continuo y pantalla, mas aperturas/recargas.
- Desactivado o pendiente: no se monta el reproductor ni se consulta la playlist; solo sigue la comprobacion de control para poder reactivarse.
- Al desactivar se desmontan imagenes/videos y se cancelan la sincronizacion y las precargas pendientes. Una transferencia ya realizada no se puede recuperar.
- Si falla el control, la pantalla deja de reproducir hasta poder validar su permiso. Es una decision conservadora: no hay reproduccion offline indefinida.
- El administrador consulta al abrir y cada 5 minutos mientras su pestana esta visible; tambien tiene actualizacion manual.
- `Conexion reciente` significa un aviso en los ultimos 11 minutos, no una prueba de que la TV este mostrando imagen en este instante. Un navegador suspendido puede retrasar la orden hasta reanudarse.

## Limites importantes

- Los visores antiguos sin `org` conservan su funcionamiento y NO se registran ni se pueden desactivar. Abrir el enlace de empresa en esas pantallas para incorporarlas al control.
- Este control opera sobre el reproductor de NeutralPublisher: NO cierra la pestana ni revoca los archivos publicos del bucket. Quien conoce una URL publica puede seguir descargandola fuera del visor; para impedirlo se necesita Storage privado y autorizacion de entrega de medios.
- No hay garantia de no superar las cuotas de Supabase. Las consultas tienen consumo bajo pero no cero; imagenes, videos, otras pestanas y descargas externas siguen contando.
- Maximo 100 registros por empresa, incluidas solicitudes pendientes/desactivadas. No se ofrece borrado para no permitir que una identidad desactivada se registre de nuevo automaticamente. Un administrador de base puede revisar registros obsoletos.
- La inscripcion anonima limitada puede recibir solicitudes abusivas de alguien que conoce el enlace de empresa. Para despliegues publicos con riesgo de abuso, agregar invitaciones de un solo uso y rate limiting de servidor antes de ampliar la cuota.

## Verificacion

`npm test` ejecuta pruebas de autorizacion entre empresas en PostgreSQL embebido (PGlite) y del ciclo pendiente/autorizado/desactivado/error del reproductor. No usa credenciales ni datos de produccion.

Las funciones con SECURITY DEFINER fijan search_path y restringen EXECUTE siguiendo la documentacion de Supabase: https://supabase.com/docs/guides/database/functions
