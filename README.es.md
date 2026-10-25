[English](README.md) · **Español** · [Français](README.fr.md)

> **Fork para Hyprland.** Este es un fork de [mochiiwuff/capri-desktop](https://github.com/mochiiwuff/capri-desktop)
> que hace funcionar a Capri en Linux con **Hyprland** (Wayland), con **opencode** además de Claude Code, y le añade
> animaciones nuevas, frases nuevas y traducción al español. Todo el mérito de Capri, su arte y su forma de actuar es
> del proyecto original. Misma licencia (MIT para el código, ver [Créditos y derechos](#créditos-y-derechos)).

# Capri

Capri, el constructo del *Proyecto Capricornio* de Cyberpunk: Edgerunners (temporada 2), vive en tu escritorio
y te cuenta lo que está haciendo tu IA (**Claude Code** u **opencode**). Se teletransporta, hace glitch, comenta
cada acción, viene a buscarte cuando la IA necesita tu permiso y lo celebra a lo grande cuando termina.

![Capri avisando de que Claude terminó](docs/done.png)

## Novedades de este fork

### Funciona en Linux / Hyprland

Los clics, la rueda y los arrastres pasan a través de ella como deben, y aun así puedes hacerle clic y arrastrarla;
se sienta en tus ventanas y las posee; nunca se queda con tu teclado; `Super+Alt+C` la esconde.
Detalles en [Instalación en Linux / Hyprland](#instalación-en-linux--hyprland).

### También con opencode

Reacciona igual a [opencode](https://opencode.ai) que a Claude Code, y en esas sesiones dice *OpenCode*.
Además **se abre sola** cuando empieza una sesión de Claude Code u opencode. Ver [opencode](#opencode).

### Animaciones nuevas

| Animación | Qué hace |
|---|---|
| **Poseer cualquier ventana** | Se mete en la ventana que estás usando, aunque esté en mosaico o maximizada, no solo en la que está sentada |
| **Bailar con tu música** | Se balancea, baja, levanta los brazos, saca sus copias al ritmo y suelta notas de luz mientras suena un reproductor |
| **Lanzarla** | Suéltala mientras mueves el ratón: sale volando, rebota en los bordes y el techo de la pantalla y aterriza |
| **Acariciarla** | Pasa el ratón despacio por su melena unas cuantas veces: se le eriza, se sonroja y te dice algo |
| **Te sigue de escritorio** | Cambia de escritorio y viene contigo, saliendo de la grieta negra con la línea roja |
| **Siestas cortas** | De vez en cuando se duerme hasta quedar en su máscara verde y se despierta sola |
| **Más animada en reposo** | Hace algo cada 7-18 segundos en vez de cada minuto o así (menú › *Más animada*) |
| **Cada animación por su nombre** | Menú › *Animaciones*: siesta, teletransporte, asomarse, sentarse, caerse, poseer, satélite, celebración, alarma, rayo, bailar, giro, salto… |

### Frases nuevas

| Cuándo | Qué dice |
|---|---|
| **Empieza una sesión** | Algo según la hora: *"Tarde de trabajo en night-city-api. Aquí estoy."* |
| **De madrugada** | *"Es tarde, choom. Uno más y a dormir, ¿vale?"* |
| **Un comando sale bien** | `git push`: *"Subido al Net. Preem."* · tests: *"Tests en verde. Preem."* · también `git commit`, `pacman`/`paru`, `docker`, instalaciones y compilaciones |
| **La acaricias** | *"Somos decenas aquí dentro, y todas nos sonrojamos."* |
| **Donde diría *choom*** | **Tu nombre**: tu usuario del sistema (`maria` → *Maria*), o el que le pongas en menú › *Cómo me llamas* |
| **Una sesión de opencode** | *OpenCode* en lugar de *Claude*: *"OpenCode terminó. Ya puedes volver."* |
| **Todo** | En **español** (menú › Idioma › Español), además de inglés y francés |

### Opciones nuevas del menú

En Linux cada interruptor dice *sí* / *no* en su nombre, porque la mayoría de barras no dibujan las marcas.

| Opción | Por defecto | Qué hace |
|---|---|---|
| **Solo con una IA abierta** | sí | Se va 45 s después de que termine la última sesión de Claude Code u opencode, o tras 20 min sin actividad de la IA; la siguiente sesión o prompt la trae de vuelta |
| **Esconderse en pantalla completa y juegos** | sí | Se mete en su biochip mientras hay algo a pantalla completa (un juego, un vídeo) o gamemode está activo |
| **Bailar con mi música** | sí | Baila mientras suena un reproductor de música (MPRIS, con `playerctl`) |
| **Bailar también con el navegador** | no | También cuando la música sale del navegador (YouTube…); viene apagada porque desde ahí un vídeo y una canción se ven igual (un vídeo a pantalla completa la esconde igualmente) |
| **Más animada** | sí | Más movimiento cuando no pasa nada, con siestas cortas |
| **Poseer una ventana** | | Ahora mismo, en la ventana que estás usando |
| **Esconderla (Super+Alt+C)** | | A su biochip, en la esquina inferior izquierda; otra vez para traerla |

## Qué hace (del proyecto original)

- **Mientras la IA trabaja**: una etiqueta sobre su cabeza dice la acción actual (`EDITA gigs.ts`, `EJECUTA npm test`…).
- **Cuando la IA te necesita** (permiso, pregunta): se teletransporta junto a tu ratón con la melena erizada.
- **Cuando falla un comando**: golpe rojo, retroceso, glitch fuerte y la línea del error que importa.
- **Cuando termina**: secuencia de victoria en el centro de la pantalla, risa con primer plano de su sonrisa, y el
  resumen (`12 acciones · 3 archivos cambiados · 2 min 14 s`) con la última frase de la IA.
- **El resto del tiempo**: flota, mira al satélite, se asoma por los bordes, se sienta en tus ventanas, se cae, se duerme…

Haz **clic** en ella para que te diga en qué anda la IA, y **arrástrala** para moverla.

## Instalación en Linux / Hyprland

Necesitas [Node.js](https://nodejs.org) 20 o superior y Hyprland (probado en 0.56, con config Lua y `.conf`).

```bash
git clone https://github.com/Asced1807/capri-hyprland.git
cd capri-hyprland
npm install
node node_modules/electron/install.js   # solo si npm no descargó Electron
npm start
```

No hay que tocar tu config de Hyprland: al arrancar, Capri registra en tiempo de ejecución su regla de ventana
(flotante, fijada en todos los escritorios, sin borde, sombra, blur ni opacidad, del tamaño del monitor) y el atajo
`Super+Alt+C` (`Ctrl+Alt+C` ya lo usa caelestia para borrar notificaciones). Los vuelve a poner tras cada recarga
de la config.

Por qué hace falta todo esto en Wayland:

- **Atravesarla**: en Wayland Electron no puede hacer una ventana "atravesable", así que Capri le pide a Hyprland que
  la ignore para el ratón (`no_focus`) y solo lo quita mientras el cursor está sobre su cuerpo.
- **El ratón y tus ventanas**: los lee del socket IPC de Hyprland (solo posiciones y tamaños, nunca títulos ni contenido).

## Conectarla a Claude Code

Menú › **Instalar hooks de Claude Code**, o:

```bash
npm run hooks:install
```

Añade un hook a `~/.claude/settings.json` (guarda copia al lado y conserva tus hooks). Reinicia tus sesiones de
Claude Code. Para quitarlo: `npm run hooks:uninstall`. Los hooks son asíncronos: nunca frenan a Claude.

## opencode

Menú › **Instalar plugin de OpenCode**, o:

```bash
npm run opencode:install
```

Escribe una línea en `~/.config/opencode/plugin/capri.js` que carga `integrations/opencode/capri.js` de tu copia.
Para quitarlo: `npm run opencode:uninstall`.

Tanto el hook de Claude Code como el plugin de opencode **abren a Capri** si no está abierta cuando empieza una
sesión. `CAPRI_AUTOSTART=0` lo desactiva.

## Probarla sin IA

```bash
npm run demo
```

O menú › **Ver la demo**: una sesión falsa completa y después todos sus trucos.

## Qué sale de tu máquina

Nada. El hook y el plugin solo guardan lo que la pantalla necesita (nombre de la herramienta, ruta del archivo,
comando, el principio de tu prompt y la última respuesta de la IA, todo recortado) y lo envían solo a `127.0.0.1`.
El contenido de tus archivos nunca se envía: de una escritura solo pasa su tamaño.

## Créditos y derechos

Capri / Proyecto Capricornio, Cyberpunk y Cyberpunk: Edgerunners pertenecen a CD PROJEKT RED, Studio Trigger y
Netflix. Es un proyecto de fans sin ánimo de lucro y sin afiliación. Las imágenes de `assets/capri/` vienen de
fotogramas de la serie y de un recorte hecho por fans; **no** están cubiertas por la licencia MIT del código.

Capri, su arte y su animación son obra de [mochiiwuff/capri-desktop](https://github.com/mochiiwuff/capri-desktop).
Este fork añade el soporte de Linux / Hyprland y opencode, las novedades de arriba y la traducción al español.
