const {getDocument} = require("pdfjs-dist/legacy/build/pdf");
const {createCanvas, Canvas, Image} = require("canvas");
const {fabric} = require("fabric");

const OG_PREVIEW_HEIGHT = 600
const OG_PREVIEW_WIDTH = 1200
const IMG_PNG = 'image/png';

async function generateOpengraphImage(gcs, gcsPath) {
    return await generatePreviewImage(gcs, gcsPath, true)
}

async function generateBrowseImage(gcs, gcsPath) {
    return await generatePreviewImage(gcs, gcsPath, false)
}

async function generatePreviewImage(gcs, gcsPath, pad) {
    const {mime, contents} = await gcs.fetchObjectRaw(gcsPath)
        .catch(err => {
            console.log(`Failed to get '${gcsPath}' raw: ${err.message}`)
            return {}
        })

    if (!contents) {
        return {}
    }

    let imageBuf
    if (mime === IMG_PNG || mime === "image/jpg" || mime === "image/jpeg") {
        imageBuf = contents
    } else if (mime === "application/pdf") {
        imageBuf = await generatePdfPreview(contents).catch(err => {
            console.log(err);
            return null
        })
    } else if (mime === "image/svg+xml") {
        imageBuf = await generateSvgPreview(contents).catch(err => {
            console.log(err);
            return null
        })
    } else {
        throw new Error(`Unsupported mime type: ${mime}`)
    }

    if (pad) {
        return padImage(imageBuf)
    } else {
        return sizeCeiling(imageBuf)
    }
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
    return canvas.toBuffer()
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

    return fabric.util.getNodeCanvas(canvas.lowerCanvasEl).toBuffer()
}

const MAX_DIM = 1600;
async function sizeCeiling(buffer) {
    let img = new Image()
    const loadPromise = new Promise((resolve, reject) => {
        img.onload = () => {
            resolve()
        }
        img.onerror = (err) => {
            reject(err)
        }
    })
    img.src = buffer
    await loadPromise

    let canvas = new Canvas(Math.min(img.width, MAX_DIM), Math.min(img.height, MAX_DIM),"image")
    let ctx = canvas.getContext("2d");

    const hRatio = canvas.width / img.width;
    const vRatio = canvas.height / img.height;
    const ratio = Math.min(hRatio, vRatio);
    const xGutter = (canvas.width - img.width * ratio) / 2;
    const yGutter = (canvas.height - img.height * ratio) / 2;
    ctx.drawImage(img, 0, 0, img.width, img.height,
        xGutter, yGutter, img.width * ratio, img.height * ratio);

    return canvas.toBuffer()
}

async function padImage(buffer) {

    let img = new Image()
    const loadPromise = new Promise((resolve, reject) => {
        img.onload = () => {
            resolve()
        }
        img.onerror = (err) => {
            reject(err)
        }
    })
    img.src = buffer
    await loadPromise

    let canvas = new Canvas(OG_PREVIEW_WIDTH, OG_PREVIEW_HEIGHT, "image")
    let ctx = canvas.getContext("2d");
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

exports.generateOpengraphImage = generateOpengraphImage;
exports.generateBrowseImage = generateBrowseImage;
exports.OG_PREVIEW_HEIGHT = OG_PREVIEW_HEIGHT;
exports.OG_PREVIEW_WIDTH = OG_PREVIEW_WIDTH;
