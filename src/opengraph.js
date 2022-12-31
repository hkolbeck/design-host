const {fabric} = require("fabric")
const {getDocument} = require("pdfjs-dist/legacy/build/pdf.js")
const {createCanvas} = require("canvas");
const NodeCache = require( "node-cache" );

const metadataCache = new NodeCache({stdTTL: 5 * 60, useClones: false});
const contentCache = new NodeCache({stdTTL: 5 * 60, useClones: false});

async function generateOpengraph(gcs, gcsPath) {
    let metadata;
    if (metadataCache.has(gcsPath)) {
        metadata = metadataCache.get(gcsPath);
    } else {
        metadata = await gcs.getMetadata(gcsPath);
        metadataCache.set(gcsPath, metadata);
    }

    return `<html lang="en">
<head>
    <meta charset="UTF-8"/>
    <title>ACAB.city</title>
    <link rel="icon" type="image/x-icon" href="/images/favicon.ico"/>
    <meta name="description" content="The LaserBloc Design Gallery"/>
    
    <meta name="twitter:title" content="${encodeQuotes(metadata.title)}">
    <meta name="twitter:text:title" content="${encodeQuotes(metadata.title)}">
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:site" content="@LaserBloc" />
    <meta name="twitter:creator" content="@LaserBloc" />
    <meta name="twitter:image" content="https://acab.city/api/preview/${encodeURI(gcsPath)}.png">
    <meta name="twitter:image:alt" content="${encodeQuotes(metadata.alt)}">
    <meta property="og:url" content="https://acab.city/gallery/${encodeURI(gcsPath)}" />
    <meta property="og:title" content="${encodeQuotes(metadata.title)}" />
    <meta property="og:description" content="${encodeQuotes(metadata.alt)}" />
    <meta property="og:image" content="https://acab.city/api/preview/${encodeURI(gcsPath)}.png" />
    <meta property="og:image:alt" content="${encodeQuotes(metadata.alt)}" />
    <meta property="og:site_name" content="ACAB.city">
</head>
<body>
</body>
</html>`
}

function encodeQuotes(str) {
    return str.replaceAll('"', "&quot;")
}

async function generatePreviewImage(gcs, gcsPath) {
    if (contentCache.has(gcsPath)) {
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
    contentCache.set(gcsPath, preview);
    return preview
}

async function getPreviewBuffer(mime, contents) {
    if (mime === "image/png" || mime === "image/jpg" || mime === "image/jpeg") {
        return {mime, contents}
    } else if (mime === "application/pdf") {
        const imgContents = await generatePdfPreview(contents).catch(err => console.log(err))
        return {mime: "image/png", contents: imgContents}
    } else if (mime === "image/svg+xml") {
        const imgContents = await generateSvgPreview(contents)
        return {mime: "image/png", contents: imgContents}
    }

    throw new Error(`Unsupported mime type: ${mime}`)
}

async function generatePdfPreview(pdfBuffer) {
    const loadTask = getDocument(pdfBuffer.buffer);
    const doc = await loadTask.promise
    const page = await doc.getPage(1)
    const viewport = page.getViewport({ scale: 10.0 });
    const canvas = createCanvas(viewport.width, viewport.height)
    const ctx = canvas.getContext('2d')
    const renderContext = {
        canvasContext: ctx,
        viewport
    };

    const renderTask = page.render(renderContext);
    await renderTask.promise;
    doc.cleanup()
    return canvas.toBuffer();
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

            // const scaleX = 2048 / grouped.getScaledWidth()

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

    return fabric.util.getNodeCanvas(canvas.lowerCanvasEl).toBuffer()
}

exports.generateOpengraph = generateOpengraph;
exports.generatePreviewImage = generatePreviewImage;