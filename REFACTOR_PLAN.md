# CRM Intelsius México — Plan de Refactor

## Objetivo
Reducir riesgo de regresión, eliminar duplicidad de estado y preparar el CRM para crecer sin seguir cargando toda la lógica en `src/App.jsx`.

## Diagnóstico resumido
El problema principal no es sólo el tamaño del archivo; es la mezcla de responsabilidades:
- UI + estado + persistencia + i18n + lógica de negocio en el mismo módulo
- estado duplicado y propenso a desincronización
- baja testabilidad
- alta probabilidad de regresiones al tocar cualquier feature

## Estrategia
Refactor incremental, con deploys pequeños y verificables. No hacer rewrite total de una sola vez.

---

## Fase 1 — Separar estado y persistencia (prioridad máxima)
**Meta:** atacar la raíz de bugs como el de actividades.

### Alcance
Mover fuera de `src/App.jsx`:
- helpers de storage/supabase
- `crmReducer`
- `CRMContext` / `useCRM` / `CRMProvider`
- constantes de datos que no son visuales directas

### Estructura objetivo
- `src/state/crmReducer.js`
- `src/state/CRMContext.jsx`
- `src/lib/supabaseOps.js`
- `src/lib/constants.js`

### Resultado esperado
- una sola fuente clara para estado CRM
- mutaciones más fáciles de auditar
- posibilidad de testear lógica sin renderizar toda la app

### Riesgo
Medio. Requiere mover piezas centrales, pero sin alterar UX.

---

## Fase 2 — Extraer componentes grandes
**Meta:** bajar complejidad y aislar vistas.

### Componentes a extraer primero
- `Kanban`
- `DealDetailModal`
- `MeddicPanel`
- `ActivitiesPanel`
- `ActivitiesDashboard`
- `ProspectingBoard`
- formularios (`CoForm`, `CtForm`, `DlForm`, `UsrForm`)

### Estructura objetivo
- `src/components/deals/`
- `src/components/activities/`
- `src/components/prospecting/`
- `src/components/forms/`
- `src/components/common/`

### Resultado esperado
- menor riesgo al cambiar una vista
- revisiones de código más claras
- menor probabilidad de conflictos de merge

### Riesgo
Medio-bajo si se hace por bloques.

---

## Fase 3 — i18n, UI base y pruebas anti-regresión
**Meta:** consolidar mantenibilidad.

### Alcance
- mover diccionarios a `src/i18n/index.js`
- mover íconos/primitivas UI a módulos propios
- agregar pruebas mínimas de regresión para:
  - crear actividad y verla sin refresh
  - editar actividad y verla reflejada en modal/dashboard
  - cambio de stage / deal detail consistente

### Resultado esperado
- cambios más seguros
- onboarding más fácil
- base lista para seguir creciendo

### Riesgo
Bajo.

---

## Guardrails obligatorios durante el refactor
1. No mezclar refactor estructural grande con cambios funcionales no relacionados.
2. Build verde en cada paso.
3. Deploy por fases pequeñas.
4. Si una extracción toca persistencia o estado, probar manualmente:
   - crear actividad
   - editar actividad
   - cambiar status
   - abrir/cerrar modal del deal
5. Mantener producción siempre desplegable.

---

## Orden recomendado de ejecución
1. Fase 1 completa
2. validar producción
3. Fase 2 por bloques
4. validar producción
5. Fase 3 + pruebas

---

## Criterio de éxito
El refactor habrá valido la pena si:
- `App.jsx` queda como composición de pantallas, no como cerebro total
- persistencia y estado quedan aislados
- el bug de desincronización deja de ser posible por diseño
- nuevas features pueden entrar sin tocar medio sistema
