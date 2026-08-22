# Módulos

Lo opcional vive acá. Un módulo se prende y se apaga desde el panel; **nunca se
borra una carpeta**. Un alumno que borra código rompe algo, no sabe qué, y
escribe a las once de la noche.

## Cómo funciona

1. El módulo se declara en `packages/core/src/index.js` (`MODULES`).
2. Su estado vive en la tabla `modules`.
3. El panel arma su menú leyendo esa tabla.
4. El servidor saltea los pasos de los módulos apagados.

Un módulo apagado no cuesta nada: no corre, no aparece y no pide claves.

## Regla de oro

Ningún módulo puede ser condición para que otro funcione. Si `payments` necesita
algo de `shipping`, esa cosa va al núcleo. Los módulos dependen del núcleo, nunca
entre ellos: en cuanto se enredan, apagar uno rompe otro y volvemos al problema
que veníamos a evitar.

## Módulos previstos

| Carpeta | Qué hace | Tanda |
|---|---|---|
| `stock/` | Existencias y aviso de faltante | 3 |
| `payments/` | Link de pago. Conector: Mercado Pago, Stripe o manual | 3 |
| `vision/` | Leer fotos y comprobantes | 3 |
| `audio/` | Transcribir notas de voz | 3 |
| `shipping/` | Conector de envíos. Por defecto no hace nada | 3 |
| `hours/` | Horario de atención por franja | 3 |
| `team/` | Asignar casos a personas | 3 |
| `ads/` | De qué aviso vino el chat | después de la v1 |
| `instagram/` | Segundo canal: DM de Instagram con una app de Meta por cliente | después de la v1 |

> **Instagram**: antes de construirlo hay que confirmar que una app en modo
> desarrollo pueda contestarle a gente sin rol en la app. Ver la decisión 8 en
> `docs/DECISIONES.md`.
