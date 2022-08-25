const {fabric} = require("fabric")
const fs = require("fs");

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
        const imgContents = await generatePdfPreview(contents)
        return {mime, contents: imgContents}
    } else if (mime === "image/svg+xml") {
        const imgContents = await generateSvgPreview(contents)
        return {mime, contents: imgContents}
    }

    throw new Error(`Unsupported mime type: ${mime}`)

}

async function generatePdfPreview(pdfBuffer) {

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

            // curves.forEach(curve => {
            //     // console.log(`Setting ${origHeight} ${origWidth}`)
            //     curve.set({
            //         top: 90,
            //         left: 90,
            //         originX: 'center',
            //         originY: 'center'
            //     });
            //     curve.scaleToWidth(100);
            //     curve.scaleToHeight(100);
            //     workingCanvas.add(curve)
            // })
    })

    return fabric.util.getNodeCanvas(canvas.lowerCanvasEl).toBuffer()
}

async function testPreview(file, mime) {
    let buffer = fs.readFileSync(file);
    const outBuffer = (await getPreviewBuffer(mime, buffer)).contents
    fs.writeFileSync(file + ".png", outBuffer)
}

testPreview("../site/img/asl-i-love-you.svg", "image/svg+xml")

exports.generateOpengraph = generateOpengraph;
exports.generatePreviewImage = generatePreviewImage;