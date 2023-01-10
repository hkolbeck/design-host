const {fabric} = require("fabric")
const {getDocument} = require("pdfjs-dist/legacy/build/pdf.js")
const {createCanvas, Canvas, Image} = require("canvas");
const NodeCache = require("node-cache");

const metadataCache = new NodeCache({stdTTL: 5 * 60, useClones: false});
const contentCache = new NodeCache({stdTTL: 5 * 60, useClones: false});

const PREVIEW_HEIGHT = 600
const PREVIEW_WIDTH = 1200

async function generateOpengraph(gcs, path, ext) {
    let gcsPath = `${path}.${ext}`

    let metadata;
    if (metadataCache.has(gcsPath)) {
        metadata = metadataCache.get(gcsPath);
    } else {
        metadata = await gcs.getMetadata(gcsPath);
        metadataCache.set(gcsPath, metadata);
    }

    let encodedPath = encodeURIComponent(path).replace(/%2f/ig, "/")
    let encodedGcsPath = encodeURIComponent(gcsPath).replace(/%2f/ig, "/")
    let alt = encodeQuotes(metadata.alt);
    let title = encodeQuotes(metadata.title);

    console.log(`Generating OpenGraph for '${encodedGcsPath}'`)
    return `<html lang="en">
<head>
    <meta charset="UTF-8"/>
    <title>ACAB.city</title>
    <link rel="icon" type="image/png" href="/img/favicon.png"/>
    <meta name="description" content="The LaserBloc Design Gallery"/>
    
    <meta name="twitter:title" content="${title}">
    <meta name="twitter:text:title" content="${title}">
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:site" content="@LaserBloc" />
    <meta name="twitter:creator" content="@LaserBloc" />
    <meta name="twitter:image" content="https://acab.city/preview/${encodedGcsPath}">
    <meta name="twitter:image:alt" content="${alt}">
    <meta name="twitter:image:width" content="${PREVIEW_WIDTH}" />
    <meta name="twitter:image:height" content="${PREVIEW_HEIGHT}" />   
    <meta property="og:title" content="${title}" />
    <meta property="og:type" content="article" />
    <meta property="og:url" content="https://acab.city/gallery/${encodedPath}?ext=${ext}" />
    <meta property="og:description" content="${alt}" />
    <meta property="og:image" content="https://acab.city/preview/${encodedGcsPath}" />
    <meta property="og:image:width" content="${PREVIEW_WIDTH}" />
    <meta property="og:image:height" content="${PREVIEW_HEIGHT}" />    
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:alt" content="${alt}" />
    <meta property="og:site_name" content="ACAB.city">
    <meta property="og:locale" content="en">
</head>
<body>
</body>
</html>`
}

function encodeQuotes(str) {
    return str.replaceAll('"', "&quot;")
}

async function generatePreviewImage(gcs, gcsPath, cache) {
    if (cache && contentCache.has(gcsPath)) {
        return contentCache.get(gcsPath);
    }

    const {mime, contents} = await gcs.fetchObjectRaw(gcsPath)
        .catch(err => {
            console.log(`Failed to get '${gcsPath}' raw: ${err.message}`)
            return {}
        })

    if (!contents) {
        return {}
    }

    const preview = getPreviewBuffer(mime, contents);

    if (cache) {
        contentCache.set(gcsPath, preview);
    }

    return preview
}

const IMG_PNG = 'image/png';

async function getPreviewBuffer(mime, contents) {
    if (mime === IMG_PNG || mime === "image/jpg" || mime === "image/jpeg") {
        return await generateImagePreview(mime, contents).catch(err => {
            console.log(err);
            return null
        })
    } else if (mime === "application/pdf") {
        return await generatePdfPreview(contents).catch(err => {
            console.log(err);
            return null
        })
    } else if (mime === "image/svg+xml") {
        return await generateSvgPreview(contents).catch(err => {
            console.log(err);
            return null
        })
    }

    throw new Error(`Unsupported mime type: ${mime}`)
}

async function generateImagePreview(mime, contents) {
    return await padImage(`data:${mime};base64,${contents.toString("base64")}`)
}

async function generatePdfPreview(pdfBuffer) {
    const loadTask = getDocument(pdfBuffer.buffer);
    const doc = await loadTask.promise.catch(err => {
        console.log("Get document:")
        console.log(err)
        return null
    })
    console.log(`Got doc: ${!!doc}`)

    const page = await doc.getPage(1).catch(err => {
        console.log("Get document:")
        console.log(err)
        return null
    })
    console.log(`Got page: ${!!page}`)

    const viewport = page.getViewport({scale: 10.0});
    const canvas = createCanvas(viewport.width, viewport.height)
    const ctx = canvas.getContext('2d')
    const renderContext = {
        canvasContext: ctx,
        viewport
    };

    const renderTask = page.render(renderContext);
    let rendered = true
    await renderTask.promise.catch(err => {
        console.log("Rendering:")
        console.log(err)
        rendered = false
    });

    doc.cleanup()

    let dataUrl = canvas.toDataURL(IMG_PNG);
    return await padImage(dataUrl)
}

async function generateSvgPreview(svgBuffer) {
    const canvas = await new Promise((resolve) => {
        const workingCanvas = new fabric.Canvas('canvas')

        const bg = new fabric.Rect({
            width: 2048,
            height: 2048,
            left: 0,
            top: 0,
            fill: '#FFFFFF'
        })
        workingCanvas.add(bg)

        fabric.loadSVGFromString(svgBuffer.toString("utf8"), (curves) => {
            const grouped = fabric.util.groupSVGElements(curves)

            grouped.set({
                left: 20,
                top: 20,
                scaleX: 8,
                scaleY: 8
            })
            workingCanvas.setWidth(grouped.getScaledWidth() + 40)
            workingCanvas.setHeight(grouped.getScaledHeight() + 40)
            workingCanvas.add(grouped).renderAll()
            resolve(workingCanvas)
        })
    })

    let dataURL = fabric.util.getNodeCanvas(canvas.lowerCanvasEl).toDataURL(IMG_PNG);
    return await padImage(dataURL)
}

async function padImage(dataUrl) {
    let canvas = new Canvas(PREVIEW_WIDTH, PREVIEW_HEIGHT, "image")
    let ctx = canvas.getContext("2d");

    let img = new Image()
    const loadPromise = new Promise((resolve, reject) => {
        img.onload = () => {
            resolve()
        }
        img.onerror = (err) => {
            reject(err)
        }
    })
    img.src = dataUrl
    await loadPromise

    ctx.fillStyle = "black"
    ctx.fillRect(0, 0, PREVIEW_WIDTH, PREVIEW_HEIGHT)
    const hRatio = canvas.width / img.width;
    const vRatio = canvas.height / img.height;
    const ratio = Math.min(hRatio, vRatio);
    const xGutter = (canvas.width - img.width * ratio) / 2;
    const yGutter = (canvas.height - img.height * ratio) / 2;
    ctx.drawImage(img, 0, 0, img.width, img.height,
        xGutter, yGutter, img.width * ratio, img.height * ratio);
    console.log(`Drew image with ratio: ${ratio}, xG: ${xGutter} yG: ${yGutter}`)

    return canvas.toBuffer()
}

exports.generateOpengraph = generateOpengraph;
exports.generatePreviewImage = generatePreviewImage;