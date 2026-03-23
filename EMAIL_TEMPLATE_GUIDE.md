## Guía para crear y editar plantillas de email

Este documento resume los puntos clave que el equipo debe respetar al construir o modificar plantillas HTML para campañas.

### 1. Variables disponibles (Jinja)

Las plantillas se renderizan con Jinja2. Variables típicas:

- **`{{ nombre }}`**: nombre del destinatario.
- **`{{ username }}`**: username del destinatario (si aplica).
- **`{{ email }}`**: email del destinatario.
- **`{{ sender_name }}`**: nombre de la persona/marca que envía.
- **`{{ extra }}`**: datos adicionales en formato JSON (usar solo si se conoce su estructura).

**Reglas:**
- Usar siempre `{{ ... }}` (doble llave) para interpolar valores.
- No usar lógica compleja en la plantilla (ifs/loops) salvo que sea estrictamente necesario.

### 2. Botones y enlaces con tracking

El backend reescribe todos los `<a href="...">` que apunten a `http://` o `https://` para poder trackear los clicks.

**Obligatorio para reportes por botón:**
- Incluir el atributo `data-button-id` en cada enlace que se quiera identificar de forma individual.

**Ejemplos recomendados:**

```html
<!-- CTA principal -->
<a
  href="https://www.elevn.me/#faq"
  target="_blank"
  data-button-id="hero-cta-apply"
>
  Be one of the first to join
</a>

<!-- CTA Discord -->
<a
  href="https://discord.gg/xxxx"
  target="_blank"
  data-button-id="discord-cta"
>
  Join our Discord
</a>

<!-- CTA final -->
<a
  href="https://www.elevn.me/#faq"
  target="_blank"
  data-button-id="final-cta-apply"
>
  Apply for the Creator Ecosystem
</a>

<!-- Unsubscribe -->
<a
  href="https://..."
  target="_blank"
  data-button-id="unsubscribe"
>
  Unsubscribe
</a>
```

**Buenas prácticas para `data-button-id`:**
- Usar nombres en inglés, cortos y descriptivos: `hero-cta-apply`, `discord-cta`, `footer-cta`, `logo`, `unsubscribe`.
- Solo caracteres `a-z`, `0-9`, `-` y `_` (sin espacios, tildes ni caracteres raros).
- Mantener consistencia entre plantillas para facilitar reportes comparables.

### 3. Pixel de apertura

No es necesario añadir manualmente ningún pixel de tracking.

- El backend inyecta automáticamente un `<img>` 1x1 al final del `<body>` con la URL correcta.
- **No** añadir otros píxeles de tracking personalizados salvo que el equipo técnico lo apruebe.

### 4. Estructura HTML y compatibilidad

- Usar tablas (`<table>`) para layout, no `flex` ni `grid`, por compatibilidad con clientes de correo.
- Incluir estilos **inline** en los elementos clave (botones, textos importantes).
- Evitar JavaScript: los clientes de correo no lo permiten o lo bloquean.
- Evitar formularios `<form>`; usar siempre enlaces a páginas externas.

### 5. Imágenes

- Usar URLs absolutas (por ejemplo, S3/CDN) y no rutas relativas.
- Añadir siempre atributo `alt` descriptivo.
- Mantener un peso razonable (< 200–300 KB por imagen cuando sea posible).

### 6. Pruebas antes de enviar campañas

Siempre que se cree o edite una plantilla:

1. **Prueba de render Jinja**:
   - Enviar una campaña de prueba a una cuenta interna.
   - Verificar que `{{ nombre }}`, `{{ sender_name }}`, etc. se reemplazan correctamente.
2. **Verificación de botones**:
   - Hacer clic en cada botón/enlace importante.
   - Confirmar que la URL final es la esperada (después del redirect de tracking).
3. **Verificación de tracking**:
   - Abrir el correo y hacer clic en algunos botones.
   - Revisar el dashboard de reportes para confirmar que:
     - Se registran **aperturas**.
     - Se registran **clicks por botón** con el `button_id` configurado.

### 7. Convenciones de nombres de botones en este proyecto

Recomendación de IDs estándar que podemos reutilizar:

- **Logo superior**: `logo`
- **CTA principal del hero**: `hero-cta-apply`
- **CTA secundaria / comunidad**: `discord-cta` o `community-cta`
- **CTA final de cierre**: `final-cta-apply`
- **Enlace de baja**: `unsubscribe`

Si se añade un nuevo botón, seguir el patrón: `<seccion>-cta-<accion>`, por ejemplo:

- `pricing-cta-view-plans`
- `feature-cta-learn-more`
- `webinar-cta-register`

