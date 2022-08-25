const {fabric} = require("fabric")
const fs = require("fs");
const {getDocument} = require("pdfjs-dist/legacy/build/pdf.js")
const {createCanvas} = require("canvas");

async function generateOpengraph(gcs, gcsPath) {
    const metadata = await gcs.getMetadata(gcsPath)

    return `<html lang="en">
<head>
    <meta charset="UTF-8"/>
    <title>ACAB.city</title>
    <link rel="icon" type="image/x-icon" href="/images/favicon.ico"/>
    <meta name="description" content="The LaserBloc Design Gallery"/>
    <meta name="twitter:title" content="${metadata.title}">
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:site" content="@LaserBloc" />
    <meta name="twitter:creator" content="@LaserBloc" />
    <meta name="twitter:image:alt" content="${metadata.alt}">
    <meta property="og:url" content="https://acab.city/gallery/${gcsPath}" />
    <meta property="og:title" content="${metadata.title}" />
    <meta property="og:description" content="${metadata.alt}" />
    <meta property="og:image" content="http://acab.city/api/preview/${gcsPath}" />
    <meta property="og:image:alt" content="${metadata.alt}" />
</head>
<body>
</body>
</html>`
}

async function generatePreviewImage(gcs, gcsPath) {
    const {mime, contents} = await gcs.fetchObjectRaw(gcsPath)
        .catch(err => {
            console.log(`Failed to get '${gcsPath}' raw: ${err.message}`)
            return {}
        })

    if (!contents) {
        return {}
    }

    return getPreviewBuffer(mime, contents)
}

async function getPreviewBuffer(mime, contents) {
    if (mime === "image/png" || mime === "image/jpg" || mime === "image/jpeg") {
        return {mime, contents}
    } else if (mime === "application/pdf") {
        const imgContents = await generatePdfPreview(contents).catch(err => console.log(err))
        return {mime, contents: imgContents}
    } else if (mime === "image/svg+xml") {
        const imgContents = await generateSvgPreview(contents)
        return {mime, contents: imgContents}
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
    return canvas.toBuffer();
}

async function generateSvgPreview(svgBuffer) {
    const canvas = await new Promise((resolve, reject) => {
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