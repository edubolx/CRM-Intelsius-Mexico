# Diagnóstico CRM — persistencia de pipeline y actividades

Fecha: 2026-04-10 UTC
Repo: `CRM-Intelsius-Mexico`
Producción: `https://codigo-crm-intelsius-ready.vercel.app`

## Resumen ejecutivo

Se confirmó una regresión real de persistencia en el CRM:

1. **Pipeline**: ciertos cambios quedaban en UI pero no persistían de forma confiable a Supabase.
2. **Actividades de deals**: al crear una actividad, el usuario veía que el formulario “desaparecía” pero la actividad no quedaba registrada.

La causa principal no fue la base de datos ni permisos de Supabase. El problema estuvo en el **flujo de aplicación**:
- dependencia excesiva en guardado global/autosave del snapshot completo,
- operaciones críticas que actualizaban UI sin garantizar persistencia inmediata,
- flujo async del formulario de actividades que reseteaba/continuaba sin un contrato claro de éxito/fracaso,
- payload de creación de actividad más amplio de lo necesario para el esquema real.

## Hallazgos confirmados

### 1) Supabase sí estaba operando correctamente
Pruebas directas por API confirmaron:
- insert en `deal_activities` = OK
- lectura posterior = OK
- borrado de cleanup = OK

Conclusión: **la DB no era la raíz primaria del fallo**.

### 2) Pipeline tenía persistencia incompleta
Antes del fix, el flujo de `savePipelineStages` actualizaba estado local pero no forzaba persistencia directa suficientemente robusta para:
- guardar cambios de stages,
- sincronizar stages eliminados,
- renombrar etapas y propagar el nombre nuevo a deals existentes.

### 3) Actividades dependían de un flujo UI frágil
La creación de actividades de deals tenía varios riesgos acumulados:
- el panel llamaba save async sin contrato explícito de retorno booleano,
- el formulario se limpiaba por flujo local aunque no hubiera una señal fuerte de éxito,
- no se mostraba error local en el panel,
- se enviaban campos no indispensables para el insert,
- el comportamiento aparente era “desaparece” en vez de “guardó” o “falló”.

## Correcciones aplicadas

### A. Persistencia directa de pipeline
Se modificó el flujo para:
- guardar `pipeline_stages` directo en Supabase,
- eliminar stages obsoletos en DB,
- renombrar deals afectados al renombrar una etapa,
- cerrar editor solo cuando el save termina OK.

### B. Persistencia directa de actividades
Se modificó el flujo para:
- crear actividad con **insert directo** a `deal_activities`,
- editar actividad con `update` directo,
- borrar actividad con `delete` directo,
- cambiar status con `update` directo,
- reflejar cambios en UI solo después del OK.

### C. Endurecimiento del formulario de actividades
Se agregó:
- `await` explícito en save del panel,
- bloqueo de doble submit mientras guarda,
- mensaje local visible si el save falla,
- reset del formulario únicamente después de confirmación de éxito.

### D. Payload mínimo para create/update
Se redujo el payload a columnas realmente necesarias del esquema:
- `id`
- `deal_id`
- `type`
- `title`
- `due_date`
- `responsible`
- `status`
- `comment`

## QA ejecutado

### QA técnico DB
- create activity por API: OK
- read-back por API: OK
- cleanup: OK

### QA funcional observado con usuario
- pipeline: OK después del fix
- actividades: OK después del fix final
- actividades de prueba eliminadas de la base

## Por qué probablemente “antes no pasaba”

La explicación más probable es una **regresión por evolución del código**:
- el sistema fue creciendo con más lógica de autosave, modales, updates locales y tabs nuevas,
- cambios de UX/estado dejaron el flujo de actividades con una dependencia implícita en snapshot/autosave,
- el contrato entre panel UI y persistencia quedó ambiguo,
- la UI ocultaba el error al usuario, por eso parecía que “guardaba y desaparecía”.

En resumen: no fue un fallo súbito de Supabase; fue una **degradación del flujo de aplicación**.

## Medidas correctivas adicionales recomendadas

### 1) Separar operaciones críticas del autosave global
**Recomendación: obligatoria.**

Mantener autosave global solo para sincronización secundaria, no para operaciones críticas.
Estas deben seguir con write directo:
- create/edit/delete deal
- stage changes
- create/edit/delete activities
- create/edit contacts/companies/users

### 2) Agregar toasts/errores visibles por operación
**Recomendación: obligatoria.**

Nunca volver a permitir “fallo silencioso”.
Cada operación crítica debe devolver uno de estos estados visibles:
- Guardado correctamente
- Error al guardar

### 3) Agregar trazas temporales o logger de operaciones
**Recomendación: alta.**

Agregar un logger sencillo para operaciones críticas:
- operación
- tabla
- id afectado
- status
- timestamp
- mensaje de error si existe

Puede ser solo `console.error/console.info` estructurado, suficiente para depuración rápida.

### 4) Smoke tests manuales fijos antes de deploy
**Recomendación: obligatoria.**

Checklist mínimo antes de cerrar cambios de CRM:
- crear deal
- editar deal
- mover deal de etapa
- crear actividad
- editar actividad
- cambiar estado de actividad
- refrescar y validar persistencia

### 5) Crear runbook / skill de QA CRM
**Recomendación: alta.**

Conviene una skill o runbook específico para CRM que obligue a validar persistencia end-to-end antes de considerar una corrección como cerrada.

### 6) Browser relay para validación visual post-deploy
**Recomendación: media-alta.**

Cuando esté disponible, usar browser relay para validar UI real de producción en vez de depender solo de lectura de código.

## Conclusión

Sí se necesitaban medidas correctivas adicionales.
No basta con “ya quedó”; el incidente mostró una debilidad de diseño y de QA:
- demasiada dependencia en autosave implícito,
- poca visibilidad de error,
- falta de smoke test obligatorio por flujo crítico.

Estado actual:
- **incidente corregido**
- **causa principal identificada**
- **riesgo reducido**
- **todavía conviene endurecer QA y observabilidad** para que no se repita.
