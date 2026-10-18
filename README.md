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
| `data/plantillas.json` | Plantilla actual de los 30 equipos (dorsal, posición, lesión) con las medias de temporada de cada jugador. Lo escribe GitHub Actions cada 6 h. |
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
   - **Inicio:** gráfico de evolución, clasificación de los 4, cartel de la cena y resumen de bonus.
   - **Comparativa y clasificación:** Este y Oeste con PJ, G, P, racha, últimos 10 y la apuesta de cada uno.
   - **Jugadores** (en el móvil, "Jug.").
   - **Calendario:** selector de día con ◀ ▶, fecha y "Hoy". Al tocar un partido se abre su ficha.
   - **Lesiones/Noticias.**
   - **Líderes.**

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

### Clasificación: siempre la de liga regular

- **Qué se pide:** tanto la web como el script piden `standings?seasontype=2`.
- **Por qué:** sin ese parámetro, ESPN devuelve la clasificación del tipo de temporada en curso, y en pretemporada eso es la pretemporada. Lo comprobamos el 18/10/2026: sin el parámetro, los Spurs salían 2-3; con él, 0-0.
- **Qué se ve hasta el primer partido de liga regular:**
  - Todo a 0-0.
  - La página de equipo pone "la liga regular aún no ha empezado".
  - El cartel de la cena dice que vais todos empatados.
- **Partidos en las páginas de equipo:** en "Últimos partidos" los de pretemporada llevan la etiqueta "pret.".

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

## Noticias

- **Origen:** dentro de la pestaña Lesiones/Noticias, botón 📰 Noticias, con las últimas 50 noticias de ESPN, en inglés. Se piden directamente desde el navegador y se guardan 10 minutos en memoria. No ocupan espacio en el repo.
  - Todas: `site.api.espn.com/apis/site/v2/sports/basketball/nba/news?limit=50`.
  - Un equipo: `...&team=<id de ESPN>`, que se elige en el desplegable. El id sale de la clasificación (`TEAMS[abbr].id`).
- **Cada noticia** muestra foto, titular, entradilla, escudos de los equipos relacionados y "hace X h". Al tocarla se abre en ESPN. Los vídeos se marcan con "▶ Vídeo".
- **Sin filtro por jugador:** la API lo ignora. Lo probamos con `athlete`, `athletes`, `athleteId` y `player`, y `athletes/<id>/news` da error.
- **En español:** existe con `&lang=es&region=us` (ESPN Deportes), pero se eligió inglés porque hay más noticias y llegan antes.

## Páginas de equipo y de jugador

En **cualquier pestaña**:
- Tocar un **escudo** abre la página del equipo.
- Tocar la **foto o el nombre de un jugador NBA** abre su ficha. Esto funciona en líderes, lesiones, apuestas de premios, plantillas y estadística de partido.
- Tocar la **cara de uno de los 4** lleva a su pestaña en *Jugadores*.
- **"← Volver"** regresa a la página anterior, y tocar una pestaña cierra la página.

**Página de equipo:**
- **KPIs** (de la clasificación de ESPN, `avgPointsFor` / `avgPointsAgainst`): puntos por partido y en contra, con su puesto entre los 30, récord, % de victorias, racha y últimos 10. En pretemporada lleva la etiqueta "pretemporada".
- **La apuesta:** dónde puso cada uno al equipo y cuántos puntos le suma.
- **Partidos:** los últimos 5 y los próximos 5, sacados de `data/calendario.json`. Al tocar uno se abre su ficha en Calendario.
- **Plantilla** con medias, lesiones y noticias del equipo (`news?team=<id>&limit=12`).

**Ficha de jugador:** se pide a ESPN al abrirla y se guarda 10 minutos en memoria.
- **Datos personales**, de `site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/<id>`: dorsal, equipo, posición en español, altura y peso en cm/kg, edad, lugar de nacimiento, draft y temporada.
- **Del mismo endpoint con `/overview`:**
  - Medias de temporada, playoffs y carrera.
  - Últimos 5 partidos (`gameLog`).
  - Noticias del jugador: aquí sí las hay, unas 13.
- **Además:** lesión actual, si la tiene, y quién lo apostó en premios.

## Líderes

- **Origen:** la pestaña Líderes muestra el top 10 de jugadores y de equipos en puntos totales, puntos, asistencias, rebotes, eficiencia y robos por partido.
  - Sale de `data/lideres.json`, unos 6 KB.
  - Lo calcula el script cada 6 horas, junto con las plantillas.
- **Jugadores:** usa el mismo `byathlete` que las plantillas. Para las medias hay que haber jugado al menos el 70 % de los partidos del que más ha jugado, que es la regla aproximada de la NBA. Los puntos totales no tienen mínimo.
- **Equipos:** `site.web.api.espn.com/apis/common/v3/sports/basketball/nba/statistics/byteam?season=2027&seasontype=2`. Hay que coger las categorías con `splitId: "0"`, las propias; el `900` es la del rival.
- **Eficiencia:** no viene en la API. Se calcula como la EFF de la NBA: PTS + REB + AST + ROB + TAP − tiros fallados − libres fallados − pérdidas, por partido.
- **Apuestas:** los jugadores apostados en premios salen con la cara de quien los apostó.
- **Temporada:** igual que las plantillas, mientras 2026-27 no tenga partidos se muestra 2025-26, y la web lo indica.

## Lesiones

- **Origen:** parte de lesiones de toda la liga de ESPN, pedido desde el navegador y guardado 10 minutos en memoria. No ocupa espacio en el repo.
  - Endpoint: `site.api.espn.com/apis/site/v2/sports/basketball/nba/injuries`, unos 50 KB.
  - Trae estado (Out / Day-To-Day), lesión (`details.type` y `side`), fecha prevista de vuelta (`details.returnDate`) y comentarios en inglés.
  - El id del jugador no viene suelto: se saca de su enlace (`/id/<n>/`).
- **Orden:** siempre de más a menos importante, según los puntos por partido de `data/plantillas.json`. Los que no tienen datos van al final.
- **Dónde se ve:**
  1. **Lesiones/Noticias → 🩹 Lesiones** (se abre por defecto): el parte completo, con el mismo filtro de equipo que las noticias, o todos. Al tocar un jugador se abre el comentario.
  2. **Ficha de cada partido no terminado:** "Lesionados" de cada equipo. En la plantilla, la etiqueta baja/duda también sale del parte en directo.
  3. **Inicio → Resumen bonus:** aviso "Lesionados entre vuestras apuestas" con quién apostó a cada uno. Además, en la cuadrícula de fotos, una cruz roja marca una baja y una naranja una duda.
- **Ids de los jugadores apostados:** están en `PICK_ESPN`, en `index.html`. Si cambia algún premio apostado, hay que añadir su id ahí.
- **Traducción:** las zonas del cuerpo se traducen con `BODY_ES`. Si sale alguna en inglés, hay que añadirla ahí.

## Ficha de cada partido (Calendario)

Al tocar un partido se abre su ficha, con "← Volver a la jornada" para salir.

- **Partido jugado o en juego:** estadística de cada jugador con MIN, PTS, REB, AST, ROB, PÉR, TC (metidos-intentados), %TC, T3, %T3 y +/-.
  - Salen primero los titulares (marcados con T), luego el banquillo, la fila de totales y "No jugaron".
  - Se pide a ESPN en el momento, desde el navegador: `.../summary?event=<id>`, unos 40 KB. No se guarda en el repo.
  - Si el partido está en directo, se refresca cada 30 s.
- **Partido sin jugar:** las dos plantillas actuales con las medias por partido de cada jugador, ordenadas por puntos. Los lesionados salen marcados como "baja" (Out) o "duda" (resto).
  - Sale de `data/plantillas.json`.
  - Si la temporada actual aún no tiene partidos, ESPN devuelve la anterior, y la web lo indica ("temporada 2025-26, la pasada").
- **Columna del nombre:** queda fija al deslizar la tabla de lado en el móvil.

### A quién le conviene que gane cada equipo

- **Regla simple, por participante y equipo:**
  - Si el equipo va **peor** de lo que apostó (por ejemplo, lo puso 3º y va 7º), le conviene que **gane**: +1.
  - Si va **mejor** de lo apostado, le conviene que **pierda**: -1.
  - Si va justo donde lo puso: 0.
- **En un partido A contra B:** se calcula `conviene(A) - conviene(B)`. Si sale positivo quiere que gane A, si sale negativo B, y si sale 0 le da igual.
- **Dónde se ve:**
  - En la lista de partidos, la foto de cada uno aparece junto al equipo que quiere que gane.
  - En la ficha sale "Quieren que gane:" con las fotos, y un desplegable **"¿Por qué?"** con dónde apostó cada equipo y dónde va.
- **No tiene en cuenta** cuántos puntos se juega cada uno ni a los rivales directos. Es orientativo.
- **En pretemporada no se muestra.** Los primeros días de liga, con casi todos los equipos empatados, será poco fiable.

### Detalles técnicos de ESPN (probados el 18/10/2026)

- **`summary?event=<id>`:** `boxscore.players[i].statistics[0]` trae:
  - `labels`: `MIN, PTS, FG, 3PT, FT, REB, AST, TO, STL, BLK, OREB, DREB, PF, +/-`.
  - `athletes[].stats`: los valores en ese orden.
  - `totals`.
- **El % por jugador no viene:** se calcula con `"metidos-intentados"`.
- **Quién no jugó:** el campo `reason` ("COACH'S DECISION") sale también en jugadores que sí jugaron. Para saber quién no jugó se usa `didNotPlay` o `stats` vacío.
- **Partido sin jugar:** `boxscore.players` viene vacío.
- **Plantillas:** `teams/<id>/roster`, una petición por equipo.
- **Medias de toda la liga en una sola petición:** `site.web.api.espn.com/apis/common/v3/sports/basketball/nba/statistics/byathlete?season=2027&seasontype=2&limit=1000`, unos 430 KB. Lo usa solo el script, no la web.
- **Pendiente de comprobar el 20/10/2026:**
  - Que la estadística en directo se actualiza durante el partido.
  - Que `byathlete` pasa a dar la temporada 2026-27 cuando haya partidos jugados.

### Copia de seguridad de las estadísticas

- **Qué guarda:** en cada ejecución, el script guarda la estadística de los partidos terminados que aún no tenía, en `data/partidos/<id>.json` (unos 7 KB por partido).
  - El formato es el mismo que `boxscore.players` de ESPN, pero solo con los campos que usa la web.
  - Guarda como mucho 60 partidos por ejecución.
  - Si ESPN aún no tiene la estadística de un partido, se reintenta en la siguiente ejecución.
- **Cuándo la usa la web:** solo si ESPN falla o no trae jugadores de un partido terminado. En ese caso lo avisa en la ficha.
- **Toda la temporada** son unos 1.230 partidos × 7 KB, unos 9 MB, y menos comprimido.

## Tamaño y límites (medido el 18/10/2026)

- **Web publicada:** unos 5 MB, casi todo fotos. El límite de GitHub Pages es 1 GB y cuenta solo los archivos actuales.
- **Repo con historial:**
  - Hoy ocupa 4,6 MB.
  - Cada commit del bot añade, como mucho, unos 15 KB (calendario) y 21 KB (plantillas) comprimidos.
  - Siendo pesimista, unos 60 MB en toda la temporada.
- **Tráfico:** una primera visita descarga unos 5 MB, y las siguientes casi nada por la caché. El límite blando es de 100 GB al mes, y 4 personas no llegan a 1 GB.

## Pendiente

- [ ] El **20/10/2026**, con los primeros partidos de liga regular, comprobar que la web pasa a datos reales y se refresca sola.
- [ ] Rellenar `results` en `data/apuestas.json` cuando se sepan copa y premios.
- [ ] El **20/10/2026**: comprobar que la ficha en directo se refresca y que las medias pasan a la temporada 2026-27.
- [ ] Ideas pendientes: estadísticas de los jugadores apostados en premios y enlaces a los rankings de premios.
- [ ] Opcional: mejorar la foto de Telmo (la original es muy pequeña y borrosa).
- [ ] Opcional: decidir si la web debe ser privada. Ahora es pública, con las caras recortadas y las apuestas visibles.
