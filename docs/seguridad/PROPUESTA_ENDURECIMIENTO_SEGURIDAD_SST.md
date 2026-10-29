# Propuesta de endurecimiento de seguridad SST

**Estado: PROPUESTA PARA REVISIÓN — NO APLICADA.**  
**Alcance:** roles de perfiles y acceso a `public.signatures`.  
**Base:** `dev/integracion-formularios-sst`.  
**Restricciones:** no modificar formatos aprobados; no ejecutar SQL en Supabase; no desplegar a producción.

## Hallazgos verificados en la auditoría de solo lectura

1. `public.handle_new_user()` crea el perfil leyendo `rol` de `NEW.raw_user_meta_data`. Los metadatos de usuario son editables durante el flujo de autenticación y no deben ser una fuente de autorización. La función tiene un trigger `on_auth_user_created` en `auth.users`.
2. La función es `SECURITY DEFINER` y no fija `search_path`. Supabase Advisor también advierte sobre sus privilegios de ejecución. Como es una función de trigger, la advertencia genérica de ejecución no demuestra por sí sola que sea invocable directamente por RPC; aun así, restringir privilegios y fijar el search path es defensa en profundidad.
3. `public.signatures` tiene RLS desactivado y concede privilegios amplios a `anon` y `authenticated`. No se debe activar RLS hasta determinar qué pantallas, flujos, integraciones o procesos dependen de esa tabla y definir políticas compatibles.
4. El usuario confirmó que realizó las pruebas funcionales de los siete formularios, incluyendo generación de PDF, firmas y almacenamiento en Supabase. Esta propuesta no modifica esos flujos ni los formatos aprobados.

## Cambio A — endurecer la creación automática de perfiles

La función debe asignar siempre el rol mínimo `trabajador` al crear un perfil nuevo. Los roles elevados deben asignarse por un procedimiento administrativo confiable, no a partir de metadatos enviados por el usuario. También debe fijar un search path vacío y usar nombres de objetos cualificados.

SQL propuesto para revisión (no ejecutar todavía):

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  INSERT INTO public.profiles (id, nombre, cedula, cargo, rol)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'nombre', 'Usuario Nuevo'),
    COALESCE(NEW.raw_user_meta_data ->> 'cedula', '0000000000'),
    COALESCE(NEW.raw_user_meta_data ->> 'cargo', 'Operativo'),
    'trabajador'::public.app_role
  );
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user()
FROM PUBLIC, anon, authenticated;
```

La revocación debe verificarse en un entorno aislado para confirmar que el trigger existente sigue funcionando con los permisos de su propietario. La función no debe eliminarse ni cambiarse el trigger `on_auth_user_created`.

### Pruebas requeridas para el cambio A

- Crear una cuenta de prueba enviando metadatos con `rol=superadmin`; verificar que su perfil queda como `trabajador`.
- Verificar que un usuario nuevo con metadatos normales también obtiene perfil y puede iniciar sesión.
- Confirmar que el superadministrador actual conserva su rol y puede consultar/descargar los PDF archivados.
- Verificar que la provisión de cuentas administrativas se realiza mediante un procedimiento de confianza y no desde el formulario público.
- Confirmar que el trigger continúa funcionando después de restringir EXECUTE.

## Cambio B — cerrar el riesgo de `public.signatures` sin romper funciones

**No se incluye todavía una migración ejecutable para esta tabla.** Antes se debe completar el inventario:

1. Obtener columnas, claves foráneas, restricciones, políticas actuales, privilegios y conteo de registros.
2. Buscar todas las lecturas/escrituras de la tabla en el repositorio, otras aplicaciones y procesos externos.
3. Determinar si las firmas son globales, propias de un usuario o vinculadas a un registro/formulario.
4. Definir políticas por operación (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) basadas en esa relación real.
5. En un entorno de prueba aislado, habilitar RLS y probar cada flujo antes de planear su aplicación al proyecto activo.

No se debe aplicar una política genérica basada en `auth.uid()` sin conocer la columna de propiedad ni revocar todos los privilegios de forma indiscriminada.

### Resultado del inventario de solo lectura (2026-10-29)

- Columnas identificadas: `id`, `document_id`, `signer_id`, `signer_name`, `signer_document`, `signature_image_url`, `signature_hash`, `document_hash_at_signing`, `position_x`, `position_y`, `page_number`, `ip_address`, `user_agent`, `signed_at`, `is_valid`.
- Relaciones: `document_id → public.documents.id` y `signer_id → public.users.id`.
- `public.signatures` tiene 0 filas en el momento de la consulta. Esto no prueba que la tabla esté en desuso ni descarta integraciones externas.
- No se encontraron referencias a los nombres de la tabla o sus columnas (`signature_image_url`, `signature_hash`, `document_id`, `signer_id`) en los archivos de aplicación revisados de la rama `dev/integracion-formularios-sst`. La app sí usa un componente de firma en el navegador para incorporar firmas a PDF, pero ese flujo no evidencia escritura en `public.signatures`.
- La tabla está sin RLS, sin políticas y con privilegios de tabla para `anon` y `authenticated`, incluidos SELECT/INSERT/UPDATE/DELETE. Por tanto, el riesgo de exposición está confirmado por configuración, aunque el conteo actual sea cero.
- El esquema incluye también `public.documents` y `public.users`, distintas del flujo de formularios digitales SST que usa `profiles`, `documentos_sst` y `registros_formularios_sst`. No se modificarán esas tablas en esta propuesta.

**Conclusión de auditoría:** no hay evidencia en la aplicación principal revisada de que se esté usando actualmente esta tabla, pero no se puede concluir que sea seguro bloquearla hasta consultar otras aplicaciones, automatizaciones o consumidores externos. El siguiente paso es confirmar con el responsable del sistema si existe otro módulo de firma documental que la utilice y, si no existe, preparar un plan de cierre controlado en entorno de pruebas.


### Revisión ampliada de dependencias (2026-10-29)

Se amplió la búsqueda a los dos repositorios SST disponibles y al esquema de base de datos:

- Las búsquedas en GitHub de `signatures`, `signature_image_url` y `documents` no devolvieron referencias en los dos repositorios revisados. La búsqueda de código de GitHub puede estar limitada por la indexación y no cubre repositorios privados o sistemas externos no conectados; por ello, el resultado no demuestra ausencia total de consumidores.
- No se encontraron funciones SQL ni triggers de usuario que mencionen `signatures` o cuyo nombre esté relacionado con firmas.
- `public.signatures` tiene claves foráneas hacia `public.documents.id` y `public.users.id`. Esto confirma que pertenece a un pequeño subsistema de firma de documentos distinto del flujo actual de formularios SST.
- `public.documents` tiene 0 filas y `public.users` tiene 2. Ambas tablas tienen RLS habilitado, pero no tienen políticas definidas; los roles `anon` y `authenticated` tienen privilegios SQL de tabla amplios, aunque RLS sin políticas normalmente impide sus operaciones de filas. No se modificó ninguna de estas tablas.
- No hay registros en `public.documents` ni `public.signatures` en la consulta actual. El conteo es una fotografía del momento de la auditoría, no una prueba de que el subsistema no sea necesario.

**Recomendación actualizada:** antes de diseñar una migración, confirmar con el responsable del producto si se planea usar o mantener el subsistema de firma documental (`public.users`, `public.documents`, `public.signatures`). Si no se utiliza, preparar en una rama separada un plan de desactivación o protección coordinada para las tres tablas, con pruebas; no borrar tablas ni cambiar políticas en la base activa. Si sí se utiliza, inventariar primero la aplicación consumidora y diseñar políticas basadas en su modelo de permisos.

## Secuencia propuesta

1. Revisar esta propuesta.
2. Preparar entorno aislado o copia de pruebas.
3. Probar primero el cambio A y documentar resultados.
4. Completar el inventario de `public.signatures` y preparar políticas específicas.
5. Ejecutar pruebas de regresión de autenticación, firma, formatos y archivo.
6. Solicitar autorización explícita antes de cualquier cambio en el Supabase activo.
7. No integrar a producción ni desplegar sin aprobación separada.

## Criterios de aceptación

- Los metadatos de una cuenta no pueden elevar su rol.
- El trigger de creación de perfiles sigue funcionando.
- El superadministrador legítimo conserva acceso.
- Operarios pueden diligenciar, generar y descargar los PDF, sin consultar el archivo privado.
- Solo el superadministrador puede listar/descargar documentos archivados.
- La política de `public.signatures` está sustentada por un inventario y pruebas de regresión.
- Los formatos aprobados permanecen sin cambios.
- Ningún cambio se aplica al Supabase activo ni se despliega a producción como parte de esta propuesta.
### Revisión del asesor de seguridad (2026-10-29, consulta de solo lectura)

La última consulta del asesor de Supabase mantiene estos hallazgos:

- **ERROR — `public.signatures`:** RLS desactivado. Prioridad alta para resolver después de confirmar consumidores y políticas correctas.
- **WARN — `public.handle_new_user()`:** `search_path` mutable y ejecución concedida a `anon` y `authenticated` para una función `SECURITY DEFINER`. La advertencia de ejecución no prueba por sí sola una vía de explotación directa; validar la función de trigger y sus permisos al preparar el cambio A.
- **INFO — `public.documents` y `public.users`:** RLS habilitado sin políticas. No añadir políticas ni cambiar permisos sin identificar primero las operaciones legítimas que necesitan estas tablas.
- **WARN — protección de contraseñas filtradas desactivada:** configuración de Auth pendiente de revisar y activar de forma controlada. No se cambió desde esta revisión.

Esta consulta solo leyó los avisos del asesor. No se ejecutó SQL, no se modificaron políticas, tablas, funciones ni ajustes de Auth. La lista de avisos es una fotografía del momento de consulta.


### Auditoría complementaria de autenticación y permisos (2026-10-29)

Consulta SQL de solo lectura sobre el proyecto activo:

- La función `public.handle_new_user()` está declarada como `SECURITY DEFINER`, pertenece a `postgres`, no tiene configuración `search_path` y el trigger habilitado `on_auth_user_created` la ejecuta después de insertar en `auth.users`.
- La función toma `rol` de `NEW.raw_user_meta_data` y lo convierte a `public.app_role`. Como esos metadatos pueden ser suministrados por el usuario durante el alta, si el registro público/self-service de Supabase Auth está habilitado, existe una vía potencial de autoasignación de un rol privilegiado (incluido `superadmin`). No se confirmó desde esta auditoría si el registro público está habilitado. La aplicación web revisada presenta inicio de sesión con `signInWithPassword` y no contiene un formulario `signUp`; eso no descarta altas por API, Dashboard u otro cliente.
- La función tiene EXECUTE para `anon` y `authenticated`. Por ser una función `RETURNS trigger`, el aviso genérico de PostgREST no prueba que pueda invocarse directamente como RPC. El riesgo principal que sí se observa en el código es confiar en metadatos editables durante el trigger de alta.
- La aplicación principal revisada no contiene llamadas a `public.signatures`, `public.documents` ni `public.users`. La pestaña de firma PDF incorpora el trazo al PDF en el navegador y genera una descarga local; no se encontró escritura en la tabla `signatures`. El flujo nuevo de formularios usa `public.profiles` y `public.registros_formularios_sst`. La búsqueda de código no cubre consumidores externos, automatizaciones ni repositorios no conectados.
- La consulta de privilegios confirma que `anon` y `authenticated` tienen SELECT, INSERT, UPDATE y DELETE (además de otros privilegios) sobre `public.signatures`. Como RLS está deshabilitado, estos permisos representan exposición efectiva a través de la API si la tabla está expuesta en el Data API.
- `public.documents` y `public.users` también conceden privilegios amplios a esos roles, pero tienen RLS habilitado y no tienen políticas; por tanto, las operaciones de filas quedan bloqueadas por RLS mientras no se definan políticas. No se encontraron políticas para ninguna de las tres tablas del subsistema de firma.

**Acción recomendada, aún no aplicada:** mantener el Cambio A de esta propuesta: asignar siempre `trabajador` al crear perfiles, fijar `search_path = ''`, cualificar los objetos y revocar EXECUTE a roles API después de probar que el trigger conserva su funcionamiento. Antes de cerrar `public.signatures`, confirmar con el responsable que ningún otro cliente o proceso la consume y decidir si se protegerá el subsistema completo o se retirará en una migración coordinada. No se ejecutó ningún cambio de base de datos.
