const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const cors = require("cors");
const fetch = require("node-fetch");
const path = require("path");

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(express.static(path.join(__dirname, "public")));

// Ruta principal que sirve index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const limpiarTexto = (texto) => {
  if (!texto) return "";
  return texto
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\n/g, "")
    .replace(/\t/g, "")
    .replace(/Exclusivo suscriptor/g, "")
    .replace(/\s{2,}/g, " ");
};

const obtenerURLBase = (url) => {
  try {
    const urlObj = new URL(url);
    return `${urlObj.protocol}//${urlObj.hostname}`;
  } catch (e) {
    return "";
  }
};

const commonConfig = {
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "es-ES,es;q=0.8,en-US;q=0.5,en;q=0.3",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    DNT: "1",
  },
  timeout: 15000,
  maxRedirects: 5,
};

app.post("/scrape", async (req, res) => {
  try {
    const { url: targetUrl, keyword } = req.body;

    if (!targetUrl) {
      return res.status(400).json({ error: "URL es requerida" });
    }

    const response = await axios.get(targetUrl, commonConfig);
    const $ = cheerio.load(response.data);
    const baseUrl = obtenerURLBase(targetUrl);
    const noticias = [];

    // Detectar el sitio web
    const isPuroMarketing = targetUrl.includes("puromarketing.com");
    const isEmol = targetUrl.includes("emol.com");

    if (isPuroMarketing) {
      // Scraping específico para puromarketing
      $(".item-news").each((_, element) => {
        const $element = $(element);

        const titulo = limpiarTexto(
          $element.find(".item-title").first().text(),
        );
        let enlace = $element.find(".item-title a").first().attr("href");
        const descripcion = limpiarTexto(
          $element.find(".item-description").first().text(),
        );

        if (enlace) {
          try {
            enlace = enlace.split("#")[0].split("?")[0];
            if (!enlace.startsWith("http")) {
              enlace = new URL(enlace, baseUrl).href;
            }
          } catch (e) {
            console.error("Error al procesar URL:", e);
            return;
          }
        }

        if (
          titulo &&
          titulo.length > 10 &&
          !titulo.match(/menu|navegacion|search|newsletter/i) &&
          enlace
        ) {
          if (
            !keyword ||
            titulo.toLowerCase().includes(keyword.toLowerCase()) ||
            descripcion.toLowerCase().includes(keyword.toLowerCase())
          ) {
            noticias.push({
              titulo,
              descripcion: descripcion || "No hay descripción disponible",
              enlace,
            });
          }
        }
      });
    } else if (isEmol) {
      // Scraping específico para emol.com
      $(
        ".col_center_noticia1-390px, .col_center_noticia2-390px, .caja_multi_model_item",
      ).each((_, element) => {
        const $element = $(element);

        const titulo = limpiarTexto(
          $element.find("h1 a, h3 a, .caja_multi_model_txt a").first().text(),
        );
        let enlace = $element
          .find("h1 a, h3 a, .caja_multi_model_txt a")
          .first()
          .attr("href");

        let descripcion = limpiarTexto(
          $element
            .find("p")
            .text()
            .replace(/^\d{2}:\d{2}\s*\|\s*/, ""),
        );

        if (enlace) {
          try {
            enlace = enlace.split("#")[0].split("?")[0];
            if (!enlace.startsWith("http")) {
              enlace = new URL(enlace, baseUrl).href;
            }
          } catch (e) {
            console.error("Error al procesar URL:", e);
            return;
          }
        }

        if (
          titulo &&
          titulo.length > 10 &&
          !titulo.match(/menu|navegacion|search|newsletter/i) &&
          enlace
        ) {
          if (
            !keyword ||
            titulo.toLowerCase().includes(keyword.toLowerCase()) ||
            descripcion.toLowerCase().includes(keyword.toLowerCase())
          ) {
            noticias.push({
              titulo,
              descripcion: descripcion || "No hay descripción disponible",
              enlace,
            });
          }
        }
      });
    } else {
      // Scraping genérico para otros sitios
      const selectores = [
        "article",
        ".article",
        ".post",
        ".entry",
        ".news-item",
        ".blog-post",
        '[class*="article"]',
        '[class*="post"]',
        '[class*="entry"]',
      ].join(", ");

      $(selectores).each((_, element) => {
        const $element = $(element);

        const titulo = limpiarTexto(
          $element
            .find('h1, h2, h3, .title, .headline, [class*="title"]')
            .first()
            .text(),
        );

        let enlace;
        const tituloLink = $element
          .find("a")
          .filter(function () {
            return (
              $(this).text().trim() === titulo ||
              $(this).find("h1, h2, h3").text().trim() === titulo
            );
          })
          .first();

        if (tituloLink.length) {
          enlace = tituloLink.attr("href");
        } else {
          enlace = $element
            .find("a")
            .not('[href*="category"], [href*="tag"], [href*="author"]')
            .first()
            .attr("href");
        }

        if (enlace) {
          try {
            enlace = enlace.split("#")[0].split("?")[0];
            if (!enlace.startsWith("http")) {
              enlace = new URL(enlace, baseUrl).href;
            }
          } catch (e) {
            console.error("Error al procesar URL:", e);
            return;
          }
        }

        const descripcion = limpiarTexto(
          $element
            .find(
              'p, [class*="excerpt"], [class*="description"], [class*="summary"]',
            )
            .first()
            .text(),
        );

        if (
          titulo &&
          titulo.length > 10 &&
          !titulo.match(/menu|navegacion|search|newsletter/i) &&
          enlace
        ) {
          if (
            !keyword ||
            titulo.toLowerCase().includes(keyword.toLowerCase()) ||
            descripcion.toLowerCase().includes(keyword.toLowerCase())
          ) {
            noticias.push({
              titulo,
              descripcion: descripcion || "No hay descripción disponible",
              enlace,
            });
          }
        }
      });
    }

    const noticiasUnicas = Array.from(new Set(noticias.map((n) => n.titulo)))
      .map((titulo) => noticias.find((n) => n.titulo === titulo))
      .filter((noticia) => noticia && noticia.enlace);

    res.json({
      sitio: baseUrl,
      total_noticias: noticiasUnicas.length,
      noticias: noticiasUnicas,
    });
  } catch (error) {
    console.error("Error en scrape:", error);
    res.status(500).json({
      error: "Error al obtener los datos",
      detalle: error.message,
    });
  }
});

app.post("/scrape-single", async (req, res) => {
  try {
    let { url } = req.body;

    if (!url) {
      return res.status(400).json({
        error: "URL es requerida",
        success: false,
      });
    }

    const isEmol = url.includes("emol.com");

    async function intentarScraping(urlToTry) {
      const config = {
        ...commonConfig,
        validateStatus: function (status) {
          return status >= 200 && status < 500;
        },
      };

      const response = await axios.get(urlToTry, config);
      if (response.status === 404) {
        throw new Error("Página no encontrada");
      }
      return response;
    }

    let response;
    try {
      response = await intentarScraping(url);
    } catch (error) {
      const alternativeUrl = url.endsWith("/") ? url.slice(0, -1) : url + "/";
      try {
        response = await intentarScraping(alternativeUrl);
        url = alternativeUrl;
      } catch (secondError) {
        throw new Error("No se pudo acceder a la página en ningún formato");
      }
    }

    const $ = cheerio.load(response.data);

    if (isEmol) {
      // Manejo específico para Emol
      const titulo = limpiarTexto(
        $("#cuDetalle_cuTitular_tituloNoticia").text(),
      );
      const bajada = limpiarTexto(
        $("#cuDetalle_cuTitular_bajadaNoticia").text(),
      );

      // Obtener fecha y autor
      let fecha = "";
      let autor = "";
      const infoNoticia = $(".info-notaemol-porfecha").text();
      if (infoNoticia) {
        const partes = infoNoticia.split("|").map((p) => p.trim());
        fecha = partes[0] || "";
        autor = partes[1] || "";
      }

      // Obtener el contenido del artículo
      let contenido = "";
      $("#cuDetalle_cuTexto_textoNoticia")
        .find("div, p")
        .each((_, element) => {
          const texto = $(element).text().trim();
          if (
            texto &&
            texto.length > 10 &&
            !texto.match(/copyright|términos|condiciones/i)
          ) {
            contenido += texto + "\n\n";
          }
        });

      // Obtener imágenes
      const imagenes = new Set();
      $(
        "#cuDetalle_cuTexto_ucImagen_contGaleria img, #cuDetalle_cuTexto_ucImagen_Img",
      ).each((_, element) => {
        const src = $(element).attr("src");
        if (src && !src.match(/avatar|icon|logo|banner|advertisement/i)) {
          try {
            const imageUrl = new URL(src, url).href;
            imagenes.add(imageUrl);
          } catch (e) {
            console.error("Error al procesar URL de imagen:", e);
          }
        }
      });

      const detalleNoticia = {
        success: true,
        titulo: titulo || "Sin título",
        bajada: bajada || "",
        fecha: fecha || "Fecha no disponible",
        autor: autor || "Autor no especificado",
        contenido: contenido.trim() || "No se pudo extraer el contenido",
        imagenes: Array.from(imagenes).slice(0, 5),
        url: url,
      };

      res.json(detalleNoticia);
    } else {
      // Manejo para otros sitios
      const selectores = {
        titulo: [
          "h1.entry-title",
          "h1.post-title",
          "article h1",
          ".article-title",
          ".post-title",
          "h1",
          "header h1",
        ],
        contenido: [
          "article .entry-content",
          ".post-content",
          ".article-content",
          ".entry-content",
          "article p",
          ".content p",
          ".post-body p",
          '[itemprop="articleBody"] p',
        ],
        fecha: [
          "time.entry-date",
          ".post-date",
          ".entry-date",
          "time[datetime]",
          ".date",
          '[itemprop="datePublished"]',
        ],
        autor: [
          ".author-name",
          ".entry-author",
          ".post-author",
          '[rel="author"]',
          ".author",
          '[itemprop="author"]',
        ],
        imagen: [
          "article img",
          ".entry-content img",
          ".post-content img",
          ".article-content img",
          '[itemprop="image"]',
        ],
      };

      const encontrarContenido = (selectoresArr) => {
        for (let selector of selectoresArr) {
          const elemento = $(selector);
          if (elemento.length) {
            return elemento;
          }
        }
        return null;
      };

      const titulo = limpiarTexto(
        encontrarContenido(selectores.titulo)?.text(),
      );
      const fecha = limpiarTexto(encontrarContenido(selectores.fecha)?.text());
      const autor = limpiarTexto(encontrarContenido(selectores.autor)?.text());

      let contenido = "";
      const contenidoElemento = encontrarContenido(selectores.contenido);
      if (contenidoElemento) {
        contenidoElemento.find("p").each((_, element) => {
          const texto = $(element).text().trim();
          if (
            texto &&
            texto.length > 10 &&
            !texto.match(/copyright|términos|condiciones/i)
          ) {
            contenido += texto + "\n\n";
          }
        });
      }

      const imagenes = new Set();
      selectores.imagen.forEach((selector) => {
        $(selector).each((_, element) => {
          const src =
            $(element).attr("src") ||
            $(element).attr("data-src") ||
            $(element).attr("data-lazy-src");

          if (src && !src.match(/avatar|icon|logo|banner|advertisement/i)) {
            try {
              const imageUrl = new URL(src, url).href;
              imagenes.add(imageUrl);
            } catch (e) {
              console.error("Error al procesar URL de imagen:", e);
            }
          }
        });
      });

      if (!contenido) {
        $("p").each((_, element) => {
          const texto = $(element).text().trim();
          if (
            texto &&
            texto.length > 10 &&
            !texto.match(/copyright|términos|condiciones/i)
          ) {
            contenido += texto + "\n\n";
          }
        });
      }

      const detalleNoticia = {
        success: true,
        titulo: titulo || "Sin título",
        fecha: fecha || "Fecha no disponible",
        autor: autor || "Autor no especificado",
        contenido: contenido.trim() || "No se pudo extraer el contenido",
        imagenes: Array.from(imagenes).slice(0, 5),
        url: url,
      };

      res.json(detalleNoticia);
    }
  } catch (error) {
    console.error("Error en scrape-single:", error);
    let mensajeError = "Error al obtener los datos de la noticia";

    if (error.response) {
      mensajeError = `Error ${error.response.status}: ${error.response.statusText}`;
    } else if (error.request) {
      mensajeError = "No se pudo conectar con el servidor";
    }

    res.status(error.response?.status || 500).json({
      error: mensajeError,
      detalle: error.message,
      success: false,
    });
  }
});

app.post("/rewrite-with-ai", async (req, res) => {
  try {
    const { titulo, contenido } = req.body;

    const prompt = `Actúa como un periodista experto y reescribe completamente esta noticia, creando una versión nueva y extensa que mantenga los hechos principales pero con un enfoque fresco y diferente.

INSTRUCCIONES DETALLADAS:

1. ESTRUCTURA:
   - Crea un nuevo título impactante y original
   - Comienza con un párrafo introductorio fuerte que enganche al lector
   - Expande el contenido significativamente (al menos 3 veces más largo)
   - Incluye subtítulos para organizar la información
   - Cierra con una conclusión fuerte

2. CONTENIDO:
   - Agrega contexto histórico relevante
   - Incluye datos estadísticos relacionados
   - Menciona casos similares o precedentes
   - Explora el impacto en diferentes sectores
   - Añade perspectivas de expertos (reales o hipotéticos)
   - Humaniza la historia con ejemplos y anécdotas

3. ESTILO:
   - Usa un tono profesional pero accesible
   - Emplea un lenguaje rico y variado
   - Incluye citas y testimonios
   - Mantén un ritmo narrativo fluido
   - Usa transiciones suaves entre párrafos
   - Asegúrate de que sea fácil de leer

NOTICIA ORIGINAL:
Título: ${titulo}

Contenido:
${contenido}

FORMATO DE RESPUESTA:
Responde con un objeto JSON con esta estructura exacta:
{
    "titulo": "El nuevo título que creaste",
    "contenido": "El contenido completo reescrito, incluyendo subtítulos y todo el desarrollo. NO incluyas la palabra 'Entradilla' ni otros marcadores de formato."
}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key":
          "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",
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-3-sonnet-20240229",
        max_tokens: 4000, // Ajustado al límite permitido
        temperature: 0.7,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error en la respuesta de Claude:", {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
      });
      throw new Error(
        `Error en la API de Claude: ${response.status} ${response.statusText}`,
      );
    }

    const data = await response.json();
    console.log("Respuesta completa de Claude:", JSON.stringify(data, null, 2));

    // Verificar la estructura de la respuesta de Claude
    if (!data.content || !data.content[0] || !data.content[0].text) {
      console.error("Estructura de respuesta inválida de Claude:", data);
      throw new Error("Formato de respuesta inválido de la API");
    }

    let respuestaIA = data.content[0].text;
    console.log("Contenido original de la respuesta:", respuestaIA);

    // Limpiar la respuesta de caracteres especiales o marcadores
    respuestaIA = respuestaIA
      .trim()
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .replace(/^['"]|['"]$/g, "")
      .replace(/^\{|\}$/g, "") // Eliminar llaves al inicio y final
      .trim();

    console.log("Contenido después de limpieza:", respuestaIA);

    let reescrito;
    try {
      // Intentar parsear el JSON de la respuesta
      reescrito = JSON.parse(respuestaIA);

      // Verificar que tenga la estructura correcta
      if (!reescrito.titulo || !reescrito.contenido) {
        throw new Error("La respuesta no tiene el formato JSON esperado");
      }

      // Limpiar el contenido de cualquier referencia al título y otros marcadores
      reescrito.contenido = reescrito.contenido
        .replace(new RegExp(`^${reescrito.titulo}\n*`), "") // Eliminar título repetido al inicio
        .replace(new RegExp(`^"titulo":\\s*"[^"]+",?\\s*\n*`), "") // Eliminar línea de "titulo": "..."
        .replace(new RegExp(`^"contenido":\\s*"[^"]*",?\\s*\n*`), "") // Eliminar línea de "contenido": "..."
        .replace(/Título original:.*?\n/g, "")
        .replace(/Contenido original:.*?\n/g, "")
        .replace(/^Entradilla:?\s*/gim, "") // Eliminar "Entradilla:" en cualquier parte del texto
        .replace(/Entradilla[:\s]*/g, "") // Asegurar que se elimine "Entradilla" en cualquier formato
        .replace(/^\s*\n/gm, "") // Eliminar líneas en blanco extras
        .trim();

      // Limpiar también el título de posibles comillas y marcadores
      reescrito.titulo = reescrito.titulo
        .replace(/^"titulo":\s*"|"$/g, "")
        .replace(/^['"]|['"]$/g, "")
        .trim();
    } catch (error) {
      console.error("Error al parsear JSON de Claude:", error);
      // Si falla el parsing, usar el texto completo como contenido
      reescrito = {
        titulo: titulo,
        contenido: respuestaIA,
      };
    }

    console.log("Respuesta final:", reescrito);
    return res.json(reescrito);
  } catch (error) {
    console.error("Error en rewrite-with-ai:", error);
    res.status(500).json({
      error: error.message,
      errorType: "AI_REWRITE_ERROR",
      originalTitle: req.body.titulo,
    });
  }
});

app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});
