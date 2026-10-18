# Apuesta NBA 2026/27

Web estática para seguir en directo la apuesta de la temporada entre 4 amigos: **Ghali, Telmo, Manu y Adrian**.

- **Web publicada:** https://adrian876.github.io/nba-apuesta-2627/
- **Repositorio:** https://github.com/adrian876/nba-apuesta-2627 (público, rama `main`, GitHub Pages)

## Reglas de la apuesta

- Gana quien tenga **menos puntos**.
- **Posiciones:** cada uno ordenó los 15 equipos del Este y los 15 del Oeste. Por cada equipo se suman los puntos de diferencia entre su posición apostada y la real. Ejemplo: apostó 4º y es 2º, suma 2.
- **Bonus** (restan puntos):
  - Copa: ganador -6, finalista -2.
  - MVP y DPOY: acertar -3, estar entre los 3 finalistas -1.
  - MIP, Entrenador y 6º hombre: acertar -6, finalista -2.
- **Premio:** los 2 últimos invitan a los 2 primeros a una cena gourmet.

## Archivos

| Ruta | Qué es |
|---|---|
| `index.html` | **La web** (HTML, CSS y JS en un solo archivo, sin dependencias ni build). |
| `data/apuestas.json` | **Las apuestas y los resultados de copa y premios.** Lo leen la web y el script. |
| `data/calendario.json` | Calendario completo con resultados. Lo escribe GitHub Actions. |
| `data/historial.json` | Puntuación de cada uno, un punto por día (fecha de Madrid). Lo escribe GitHub Actions. |
| `scripts/update.mjs` | Script que actualiza el calendario y el historial con datos de ESPN. |
| `.github/workflows/update.yml` | Tarea de GitHub Actions que ejecuta el script cada 30 min y hace commit si hay cambios. |
| `img/people/` | Avatares de los 4 participantes, recortados de las fotos originales. |
| `img/awards/` | Fotos de los jugadores y entrenadores apostados en premios (ESPN y Wikipedia). |
| `img/food/` | Platos gourmet del cartel de la cena (Wikimedia Commons, CC BY 4.0, Hiša Franko). |
| `img/bg/` | Fotos de fondo de Wembanyama, Jokić, Dončić, LeBron y Giannis (Wikimedia Commons). |
| `Imagenes jugadores/`, `WhatsApp Image ...jpeg` | Originales de las fotos y de las apuestas escritas a mano. **No se suben al repo.** |

## Cómo funciona

1. Al abrir la página (y cada 2 minutos, constante `REFRESH_MS`) pide la clasificación a la API pública de ESPN:
   `https://site.api.espn.com/apis/v2/sports/basketball/nba/standings`
   Tiene CORS abierto y no necesita clave.
2. Calcula los puntos de cada participante en el navegador. No hay servidor.
3. Guarda la última respuesta en `localStorage`. Si ESPN falla, muestra esos datos con un aviso.
4. Pestañas:
   - **Marcador:** tarjetas, cartel de la cena, gráfico de evolución y tabla de bonus.
   - **Comparativa y clasificación:** Este y Oeste con PJ, G, P, racha, últimos 10 y la apuesta de cada uno.
   - **Por jugador.**
   - **Calendario:** selector de día con ◀ ▶, fecha y "Hoy".

La clasificación solo cambia cuando **termina** un partido. No es en directo jugada a jugada.

### GitHub Actions (datos guardados en el repo)

- Cada 30 minutos GitHub ejecuta `scripts/update.mjs`. Se puede lanzar a mano en la pestaña *Actions* del repo, con *Actualizar datos* y luego *Run workflow*.
- **Calendario:**
  - Cada 6 horas se reconstruye entero, pidiendo el calendario de cada uno de los 30 equipos (ESPN no deja pedir rangos de fechas).
  - En cada ejecución se refrescan los marcadores de ayer, hoy y mañana.
- **Historial:** guarda la puntuación del día. Si ya existe la de hoy, la sobrescribe, así que queda la última del día. En pretemporada guarda 0.
- **Commits:** solo se hace commit si algo cambió, y cada commit vuelve a publicar la web en GitHub Pages.
- **Inactividad:** GitHub desactiva las tareas programadas de repos sin actividad en 60 días. Los commits automáticos lo evitan, pero si un día deja de actualizarse, mira la pestaña *Actions*.

### Calendario

- **Agrupación:** los partidos se agrupan por **jornada de EE. UU.**, como ESPN y la NBA. Las horas se muestran en **hora española**. Si un partido cae ya en el día siguiente en España, se indica, por ejemplo "01:00 · mié".
- **Marcadores:** si el día elegido es ayer, hoy o mañana, la web pide además los marcadores en directo a ESPN. Así se ve "En directo" con el cuarto y el tiempo.

### Gráfico de evolución

- **Datos:** un punto por día, desde el 18/10/2026, que es cuando se empezó a guardar. Sale de `data/historial.json`, y el punto de hoy usa siempre la puntuación en vivo.
- **Eje:** está invertido, así que menos puntos aparecen más arriba.
- **Fotos:** al final de cada línea sale la foto de cada uno con su puntuación. Si coinciden, se separan.

## Cómo modificar cosas

- **Apuestas:** `players` en `data/apuestas.json`. Los equipos van por abreviatura de ESPN (`NY`, `SA`, `GS`, `NO`, `UTAH`, `LAL`...) en orden de posición 1 a 15. Los premios usan un id (`wembanyama`, `doncic`...).
- **Nombres de premios:** objeto `NAMES` en `index.html` (id a nombre completo). Para añadir un jugador nuevo hace falta su foto en `img/awards/<id>.png`. Los entrenadores usan `.jpg`, y esos ids están en `JPG`.
- **Resultados de copa y premios:** `results` en `data/apuestas.json`. Cuando se sepan, rellenar `winner` y `finalists`. Mientras `winner` sea `null` figura como "pendiente".
  - Copa: ids de equipo (`'LAL'`).
  - Premios: ids de persona (`'wembanyama'`).
  - `finalists` son los finalistas (los 3 en MVP y DPOY, los 2 de la final en la copa). Si el ganador coincide con la apuesta se aplica el bonus de ganador, y si no, el de finalista si está en la lista.
- **Fechas de temporada:** se leen de ESPN (`REG`). Si falla, quedan los valores por defecto: del 20/10/2026 al 12/04/2027.
- **Puntos de los bonus:** están en `BETS`, tanto en `index.html` como en `scripts/update.mjs`. Si se cambian, hay que cambiarlos en los dos.
- **Temporada del script:** el script tiene la temporada fija (`season=2027` en `SCHEDULE`). Para la próxima temporada hay que cambiarla.

## Cómo publicar cambios

Esta carpeta **es el repositorio** (remoto `origin`, rama `main`). `.gitignore` deja fuera las fotos originales, la foto de las apuestas y `.claude/`.

GitHub Actions hace commits de datos cada poco, así que **siempre hay que traer sus cambios antes de subir los tuyos**:

```bash
git pull --rebase
git add -A && git commit -m "Lo que sea" && git push
```

GitHub Pages tarda 1-2 minutos en reflejar los cambios.

## Probar en local

La web carga los JSON con `fetch`, así que no funciona abriendo el archivo directamente (`file://`). Hay que levantar un servidor:

```bash
python3 -m http.server 8000   # y abrir http://localhost:8000
node scripts/update.mjs       # actualizar los datos a mano (necesita Node 18+)
```

## Decisiones y suposiciones

- Las clasificaciones son **por conferencia** (15 Este y 15 Oeste), no una sola del 1 al 30.
- **"Copa"** se tomó como un premio más con bonus -6/-2. No se ha decidido si es la Copa NBA o el campeonato, solo hay que rellenar `RESULTS.cup` cuando se sepa.
- **Entrenador de Adrian:** "San Antonio" se interpretó como Mitch Johnson.
- **6º hombre de Manu:** Ayo Dosunmu (confirmado por Manu).
- **Pretemporada:** hasta el 20/10/2026 ESPN devuelve récords de pretemporada. La web los ignora: puntos a 0, récords a 0, columna "#" con "-" y equipos en orden alfabético. Al empezar la liga regular pasa sola a datos reales.
- **Cartel de la cena:** el contador cuenta hasta el final de la liga regular (12/04/2027). Los nombres de quién paga y quién come se calculan siempre con la clasificación actual, también en pretemporada, así que hasta el 20/10 son orientativos.
- El orden de equipos usa `playoffSeed` de ESPN, con desempate por porcentaje de victorias y diferencia de puntos.
- Se quitó el pie de créditos de las fotos a petición del usuario. Las fotos de Wikimedia con licencia CC BY piden atribución si la web se difunde de forma abierta.

## Idea pendiente: estadísticas de cada partido (probado el 18/10/2026, NO implementado)

**Objetivo:** en el Calendario, al tocar un partido, ver la estadística de cada jugador. Las columnas serían minutos, puntos, rebotes, asistencias, robos, tiros (metidos/intentados), triples (metidos/intentados), % de tiro, % de triples, pérdidas y +/-.

### Lo que se probó

- **Endpoint:** `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=<id>`. El `<id>` es el `id` de cada partido en `data/calendario.json`.
- **Se puede pedir desde el navegador:** responde con `access-control-allow-origin: *` y `cache-control: max-age=8`. No hace falta guardarlo en el repo, la web lo puede pedir al tocar el partido.
- **Tamaño:** unos 40 KB por partido. Se pide solo al abrir uno.
- **Probado con un partido jugado** (pretemporada, Jazz en Suns, 16/10/2026, id `401908948`). Funciona y trae todo lo pedido:
  - `boxscore.players`: un elemento por equipo (`team.abbreviation`).
  - `boxscore.players[i].statistics[0].labels`: `MIN, PTS, FG, 3PT, FT, REB, AST, TO, STL, BLK, OREB, DREB, PF, +/-`.
  - `...statistics[0].athletes[]`: un elemento por jugador:
    - `athlete.displayName`, `athlete.jersey`, `athlete.position.abbreviation` y `athlete.headshot.href` (foto).
    - `starter` (titular sí o no) y `didNotPlay`.
    - `stats`: array de textos en el mismo orden que `labels`. Ejemplo: `["27","19","5-12","3-7","6-6","5","1","0","1","0","1","4","1","0"]`.
  - `...statistics[0].totals`: los totales del equipo, en el mismo orden.
  - **FG y 3PT** vienen como `"metidos-intentados"` (`"5-12"`). **El % por jugador no viene**: hay que calcularlo (5/12 = 41,7 %). El % del equipo sí viene, en `boxscore.teams[i].statistics` ("Field Goal %", "Three Point %").
  - **+/-** viene como texto: `"+10"`, `"0"`, `"-4"`.
- **Jugadores que no jugaron:** tienen `didNotPlay: true` y `stats: []`. Ojo: el campo `reason` ("COACH'S DECISION") aparece también en jugadores que **sí** jugaron. Para saber si alguien jugó hay que usar `didNotPlay` o `stats` vacío, nunca `reason`.
- **Probado con un partido sin jugar** (Celtics-Pistons, 20/10/2026, id `401909088`): `boxscore.players` viene **vacío** y el estado es `pre`. La web debería mostrar algo como "Las estadísticas aparecen cuando empiece el partido".

### Lo que NO se pudo probar

- **Partidos en directo:** no había ninguno en juego. Es de esperar que `summary` vaya actualizando la estadística durante el partido (por eso el caché es de 8 s), pero hay que comprobarlo el **20/10/2026** con el primer partido de liga regular. Si funciona, la ficha del partido abierto se puede refrescar cada 30-60 s.
- **Liga regular:** solo se probó con pretemporada. Se espera el mismo formato, a confirmar el 20/10.

### Cómo se haría (plan)

1. **Calendario:** cada tarjeta de partido se puede tocar si su `st` es `in` o `post`.
2. **Al tocarla:** se abre un panel con dos tablas, una por equipo, con los titulares primero y luego el banquillo.
3. **Columnas:** MIN, PTS, REB, AST, STL, TO, FG, FG%, 3PT, 3P% y +/-. Los que no jugaron van al final en gris, con "No jugó".
4. **Totales:** la fila de totales del equipo, con el % de tiro de `boxscore.teams`.
5. **Móvil:** la tabla será ancha, así que la columna del nombre irá fija a la izquierda y el resto se deslizará de lado.

## Pendiente

- [ ] El **20/10/2026**, con los primeros partidos de liga regular, comprobar que la web pasa a datos reales y se refresca sola.
- [ ] Rellenar `results` en `data/apuestas.json` cuando se sepan copa y premios.
- [ ] Ideas pendientes: estadísticas de los jugadores apostados en premios, lesionados, y enlaces a los rankings de premios.
- [ ] Opcional: mejorar la foto de Telmo (la original es muy pequeña y borrosa).
- [ ] Opcional: decidir si la web debe ser privada. Ahora es pública, con las caras recortadas y las apuestas visibles.
