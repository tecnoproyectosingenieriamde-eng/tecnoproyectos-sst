-- Propuesta de endurecimiento de creación de perfiles.
-- Esta migración se prepara en una rama de revisión y NO debe aplicarse
-- al proyecto Supabase activo sin aprobación y pruebas del flujo de invitación.
--
-- Garantiza que los metadatos suministrados durante el alta no puedan
-- asignar roles privilegiados. Los roles elevados deben asignarse mediante
-- un procedimiento administrativo confiable posterior al alta.

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

-- La revocación de EXECUTE a anon/authenticated queda deliberadamente fuera
-- de esta primera migración. Debe probarse por separado que el trigger
-- existente puede ejecutarse correctamente antes de restringir esos grants.
