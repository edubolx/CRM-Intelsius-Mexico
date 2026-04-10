# QA Checklist — CRM Persistence (Safe, Non-Destructive)

Usar después de cualquier cambio que toque CRUD, pipeline, actividades o sincronización con Supabase.

## Regla de seguridad
- No borrar tablas
- No correr migraciones destructivas
- No hacer deletes masivos
- Si se crean registros de prueba, eliminarlos por ID/título exacto al final

## Smoke test mínimo

### 1) Pipeline
- Editar nombre de una etapa de prueba
- Guardar
- Confirmar que sigue tras refresh
- Revertir el cambio

### 2) Deal
- Crear un deal de prueba
- Confirmar que aparece
- Refrescar página
- Confirmar que sigue
- Eliminar solo ese deal de prueba

### 3) Actividad
- Abrir un deal real o de prueba
- Crear una actividad con título único (ej. `QA <timestamp>`)
- Guardar
- Cerrar modal / reabrir
- Refrescar página
- Confirmar que sigue
- Editar actividad
- Cambiar status
- Refrescar página
- Confirmar persistencia
- Borrar solo esa actividad de prueba

### 4) Error visibility
- Si falla una operación, debe existir señal visible:
  - indicador superior en rojo, o
  - mensaje local de error en panel
- Nunca aceptar fallo silencioso

## Criterio de salida
Solo considerar el cambio “cerrado” si:
- todas las operaciones críticas persisten tras refresh
- no quedaron registros de prueba
- no hubo errores silenciosos
